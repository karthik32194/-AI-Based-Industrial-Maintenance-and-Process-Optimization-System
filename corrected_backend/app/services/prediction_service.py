"""
Prediction Service — Section 15 / Section 7.5
Orchestrates: sensor data → ML inference → store prediction + anomaly.
"""
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import MLInferenceException, NotFoundException
from app.core.logging import get_logger
from app.ml.anomaly import detect_anomaly
from app.ml.prediction import predict_failure
from app.models.anomaly import Anomaly
from app.models.machine import Machine
from app.models.prediction import Prediction
from app.models.sensor_reading import SensorReading

logger = get_logger(__name__)


def run_prediction(
    machine_id: uuid.UUID,
    db: Session,
    override_reading: dict | None = None,
) -> Prediction:
    """
    Run the full ML inference pipeline for a machine.

    Steps:
    1. Load the latest sensor reading (or use override_reading).
    2. Run anomaly detection.
    3. Run failure-risk prediction.
    4. Persist Prediction record.
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
    latest: SensorReading | None = (
        db.query(SensorReading)
        .filter(SensorReading.machine_id == machine_id, SensorReading.is_valid == True)
        .order_by(SensorReading.timestamp.desc())
        .first()
    )

    sensor_fields = [
        "temperature", "vibration", "pressure", "humidity", "rotation_speed",
        "voltage", "current", "oil_level", "load", "motor_temperature",
        "gearbox_temperature", "sound_level", "fan_speed", "reactive_power",
        "active_power", "rpm", "power_consumption",
    ]

    reading = {}
    if latest is not None:
        reading = {field: getattr(latest, field, None) for field in sensor_fields}
        reading["timestamp"] = latest.timestamp

    if override_reading:
        # Overrides replace only supplied values; missing channels come from the
        # latest stored full reading and are then safely imputed by the model.
        reading.update({k: v for k, v in override_reading.items() if v is not None})

    if not reading:
        raise NotFoundException(
            f"No sensor data found for machine '{machine_id}'. "
            "Provide sensor values or ingest a sensor reading first."
        )

    logger.info("ml_inference_start", machine_id=str(machine_id))

    # 2. Anomaly detection
    try:
        anomaly_result = detect_anomaly(reading)
    except Exception as exc:
        logger.error("anomaly_detection_failed", error=str(exc))
        anomaly_result = {"is_anomaly": False, "anomaly_score": 0.0, "anomaly_type": None}

    # 3. Failure prediction
    try:
        prediction_result = predict_failure(reading)
    except Exception as exc:
        logger.error("failure_prediction_failed", error=str(exc))
        raise MLInferenceException(f"Failure prediction failed: {exc}") from exc

    # 4. Store Prediction
    prediction = Prediction(
        machine_id=machine_id,
        failure_probability=prediction_result["failure_probability"],
        predicted_failure=prediction_result.get("predicted_failure"),
        risk_level=prediction_result["risk_level"],
        health_status=prediction_result["health_status"],
        health_score=prediction_result.get("health_score"),
        anomaly_detected=anomaly_result["is_anomaly"],
        model_version=prediction_result.get("model_version", "v1.0"),
        input_temperature=reading.get("temperature"),
        input_vibration=reading.get("vibration"),
        input_pressure=reading.get("pressure"),
        input_humidity=reading.get("humidity"),
        input_rotation_speed=reading.get("rotation_speed"),
        input_voltage=reading.get("voltage"),
        input_current=reading.get("current"),
        input_oil_level=reading.get("oil_level"),
        input_load=reading.get("load"),
        input_motor_temperature=reading.get("motor_temperature"),
        input_gearbox_temperature=reading.get("gearbox_temperature"),
        input_sound_level=reading.get("sound_level"),
        input_fan_speed=reading.get("fan_speed"),
        input_reactive_power=reading.get("reactive_power"),
        input_active_power=reading.get("active_power"),
        input_rpm=reading.get("rpm"),
        input_power_consumption=reading.get("power_consumption"),
    )
    db.add(prediction)

    # 5. Store Anomaly if detected
    if anomaly_result["is_anomaly"]:
        anomaly = Anomaly(
            machine_id=machine_id,
            anomaly_score=anomaly_result["anomaly_score"],
            anomaly_type=anomaly_result.get("anomaly_type"),
            description=f"Anomaly detected: {anomaly_result.get('anomaly_type', 'Unknown')}",
            temperature=reading.get("temperature"),
            vibration=reading.get("vibration"),
            pressure=reading.get("pressure"),
            humidity=reading.get("humidity"),
            rotation_speed=reading.get("rotation_speed"),
            voltage=reading.get("voltage"),
            current=reading.get("current"),
            oil_level=reading.get("oil_level"),
            load=reading.get("load"),
            motor_temperature=reading.get("motor_temperature"),
            gearbox_temperature=reading.get("gearbox_temperature"),
            sound_level=reading.get("sound_level"),
            fan_speed=reading.get("fan_speed"),
            reactive_power=reading.get("reactive_power"),
            active_power=reading.get("active_power"),
            rpm=reading.get("rpm"),
            power_consumption=reading.get("power_consumption"),
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
        risk=prediction.risk_level,
        probability=prediction.failure_probability,
    )
    return prediction
