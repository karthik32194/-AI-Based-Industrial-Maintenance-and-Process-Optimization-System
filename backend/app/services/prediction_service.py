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
        reading = {
            "temperature": latest.temperature,
            "vibration": latest.vibration,
            "pressure": latest.pressure,
            "rpm": latest.rpm,
            "power_consumption": latest.power_consumption,
        }

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
