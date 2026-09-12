"""
Sensor Service — Section 15
Business logic for sensor reading validation, storage and retrieval.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.core.logging import get_logger
from app.ml.preprocessing import validate_reading
from app.models.machine import Machine
from app.models.sensor_reading import SensorReading
from app.schemas.sensor_reading import SensorReadingCreate

logger = get_logger(__name__)


def ingest_sensor_reading(
    machine_id: uuid.UUID,
    payload: SensorReadingCreate,
    db: Session,
) -> SensorReading:
    """
    Validate and store a sensor reading.
    - Checks machine existence.
    - Validates channel values against operational bounds.
    - Marks reading invalid if all channels fail validation.
    """
    machine = db.get(Machine, machine_id)
    if not machine:
        raise NotFoundException(f"Machine '{machine_id}' not found.")

    raw = payload.model_dump(exclude={"timestamp"})
    validated = validate_reading(raw)

    # is_valid = False if all provided channels were out of range
    provided = {k: v for k, v in raw.items() if v is not None and k in validated}
    is_valid = any(validated.get(k) is not None for k in provided)

    # Phase 5: persist all 15 channels. The 5 canonical channels pass through
    # bounds validation; the 10 raw dataset channels have no scientific bounds
    # in the contract, so they are stored as provided (or None).
    reading = SensorReading(
        machine_id=machine_id,
        temperature=validated.get("temperature"),
        vibration=validated.get("vibration"),
        pressure=validated.get("pressure"),
        rpm=validated.get("rpm"),
        power_consumption=validated.get("power_consumption"),
        humidity=raw.get("humidity"),
        voltage=raw.get("voltage"),
        current=raw.get("current"),
        oil_level=raw.get("oil_level"),
        load=raw.get("load"),
        motor_temperature=raw.get("motor_temperature"),
        gearbox_temperature=raw.get("gearbox_temperature"),
        sound_level=raw.get("sound_level"),
        fan_speed=raw.get("fan_speed"),
        reactive_power=raw.get("reactive_power"),
        source=raw.get("source", "manual"),
        is_valid=is_valid,
        timestamp=payload.timestamp or datetime.utcnow(),
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    logger.info(
        "sensor_reading_stored",
        machine_id=str(machine_id),
        reading_id=str(reading.id),
        is_valid=is_valid,
    )
    return reading


def get_latest_reading(machine_id: uuid.UUID, db: Session) -> SensorReading | None:
    """Return the most recent valid sensor reading for a machine."""
    return (
        db.query(SensorReading)
        .filter(SensorReading.machine_id == machine_id, SensorReading.is_valid == True)
        .order_by(SensorReading.timestamp.desc())
        .first()
    )
