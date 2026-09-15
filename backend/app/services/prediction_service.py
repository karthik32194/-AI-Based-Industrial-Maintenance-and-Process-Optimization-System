"""
Prediction Service — Section 15 / Section 7.5, Phase 5
Orchestrates: sensor data -> ML boundary (15-var representation) -> anomaly +
failure-risk inference -> store prediction + anomaly.
Model availability is handled explicitly (PHASE 5 Step 5 HARD): when a
required ML artifact is missing/corrupt, an UNAVAILABLE prediction record is
persisted and returned. It is never silently treated as healthy/low-risk.
"""
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.core.logging import get_logger
from app.ml.service import (
    MLUnavailableError,
    build_pipeline_reading,
    run_inference,
)
from app.models.anomaly import Anomaly
from app.models.machine import Machine
from app.models.prediction import (
    ML_STATUS_UNAVAILABLE,
    ML_STATUS_VALID,
    Prediction,
)
from app.models.sensor_reading import SensorReading

logger = get_logger(__name__)


def _reading_from_row(latest: SensorReading) -> dict:
    """Build the full raw reading dict from a stored SensorReading row."""
    return {
        "temperature": latest.temperature,
        "vibration": latest.vibration,
        "pressure": latest.pressure,
        "rpm": latest.rpm,
        "power_consumption": latest.power_consumption,
        "humidity": latest.humidity,
        "voltage": latest.voltage,
        "current": latest.current,
        "oil_level": latest.oil_level,
        "load": latest.load,
        "motor_temperature": latest.motor_temperature,
        "gearbox_temperature": latest.gearbox_temperature,
        "sound_level": latest.sound_level,
        "fan_speed": latest.fan_speed,
        "reactive_power": latest.reactive_power,
    }


def _snapshot_inputs(reading15: dict) -> dict:
    """Map the 15-var dataset-name representation onto Prediction input fields."""
    return {
        "input_temperature": reading15.get("temperature"),
        "input_vibration": reading15.get("vibration"),
        "input_pressure": reading15.get("pressure"),
        "input_rpm": reading15.get("rotation_speed"),
        "input_power_consumption": reading15.get("active_power"),
        "input_humidity": reading15.get("humidity"),
        "input_voltage": reading15.get("voltage"),
        "input_current": reading15.get("current"),
        "input_oil_level": reading15.get("oil_level"),
        "input_load": reading15.get("load"),
        "input_motor_temperature": reading15.get("motor_temperature"),
        "input_gearbox_temperature": reading15.get("gearbox_temperature"),
        "input_sound_level": reading15.get("sound_level"),
        "input_fan_speed": reading15.get("fan_speed"),
        "input_reactive_power": reading15.get("reactive_power"),
    }


def run_prediction(
    machine_id: uuid.UUID,
    db: Session,
    override_reading: dict | None = None,
) -> Prediction:
    """
    Run the full ML inference pipeline for a machine.

    Steps:
    1. Load the latest sensor reading (or use override_reading).
    2. Build the 15-variable dataset-name representation.
    3. Run anomaly detection + failure-risk prediction via the ML boundary.
    4. Persist Prediction record (VALID or UNAVAILABLE, never fake healthy).
    5. Persist Anomaly record if anomaly detected.
    6. Return the stored Prediction.

    Args:
        machine_id:       Target machine UUID.
        db:               SQLAlchemy session.
        override_reading: Optional sensor values; if None uses latest DB reading.

    Returns:
        Persisted Prediction ORM object.
    """
    machine = db.get(Machine, machine_id)
    if not machine:
        raise NotFoundException(f"Machine '{machine_id}' not found.")

    # 1. Resolve sensor reading
    if override_reading:
        reading = {k: v for k, v in override_reading.items() if v is not None}
    else:
        latest: SensorReading | None = (
            db.query(SensorReading)
            .filter(SensorReading.machine_id == machine_id, SensorReading.is_valid == True)
            .order_by(SensorReading.timestamp.desc())
            .first()
        )
        if not latest:
            raise NotFoundException(
                f"No valid sensor readings found for machine '{machine_id}'. "
                "Ingest sensor data first."
            )
        reading = _reading_from_row(latest)

    logger.info("ml_inference_start", machine_id=str(machine_id))

    # 2. Build canonical ML representation (15 raw variables, dataset names).
    reading15 = build_pipeline_reading(reading)

    # 3. Run both models via the integration boundary.
    try:
        result = run_inference(reading15)
        ml_status = ML_STATUS_VALID
        ml_error = None
    except MLUnavailableError as exc:
        # PHASE 5 Step 5 HARD: represent explicitly, do NOT silently fall back
        # to healthy/low-risk.
        logger.error("ml_unavailable_prediction", machine_id=str(machine_id), error=str(exc))
        ml_status = ML_STATUS_UNAVAILABLE
        ml_error = str(exc)
        result = None

    failure = result["failure_result"] if result else None
    anomaly_result = result["anomaly_result"] if result else None
    anomaly_detected = bool(anomaly_result and anomaly_result["is_anomaly"])

    # 4. Store Prediction
    prediction = Prediction(
        machine_id=machine_id,
        failure_risk_score=failure.get("failure_risk_score") if failure else None,
        risk_flag=failure.get("risk_flag") if failure else None,
        health_score=failure.get("health_score") if failure else None,
        anomaly_detected=anomaly_detected,
        ml_status=ml_status,
        ml_error=ml_error,
        model_version=failure.get("model_version") if failure else None,
        **_snapshot_inputs(reading15),
    )
    db.add(prediction)

    # 5. Store Anomaly if detected
    if anomaly_result and anomaly_result["is_anomaly"]:
        anomaly = Anomaly(
            machine_id=machine_id,
            anomaly_score=anomaly_result["anomaly_score"],
            anomaly_type=anomaly_result.get("anomaly_type"),
            description=f"Anomaly detected: {anomaly_result.get('anomaly_type', 'Unknown')}",
            temperature=reading15.get("temperature"),
            vibration=reading15.get("vibration"),
            pressure=reading15.get("pressure"),
            rpm=reading15.get("rotation_speed"),
            power_consumption=reading15.get("active_power"),
        )
        db.add(anomaly)
        logger.info(
            "anomaly_stored",
            machine_id=str(machine_id),
            score=anomaly_result["anomaly_score"],
        )

    db.commit()
    db.refresh(prediction)

    logger.info(
        "ml_inference_complete",
        machine_id=str(machine_id),
        ml_status=prediction.ml_status,
        risk_score=prediction.failure_risk_score,
    )
    return prediction