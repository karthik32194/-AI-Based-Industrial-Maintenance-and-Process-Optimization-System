"""
Sensor Data API — Section 7.3
Endpoints:
  POST /api/machines/{id}/sensor-readings  — ingest a new sensor reading
  GET  /api/machines/{id}/sensor-readings  — view historical readings
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_maintenance_engineer_or_admin
from app.core.exceptions import NotFoundException
from app.db.session import get_db
from app.models.machine import Machine
from app.models.sensor_reading import SensorReading
from app.models.user import User
from app.schemas.sensor_reading import (
    SensorReadingCreate,
    SensorReadingListResponse,
    SensorReadingResponse,
)

router = APIRouter(prefix="/machines", tags=["Sensor Data"])


@router.post(
    "/{machine_id}/sensor-readings",
    response_model=SensorReadingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a sensor reading for a machine",
)
def create_sensor_reading(
    machine_id: uuid.UUID,
    payload: SensorReadingCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_maintenance_engineer_or_admin),
) -> SensorReadingResponse:
    """
    Accept and store one sensor reading for the specified machine.
    All five channels are optional but at least one must be provided.
    """
    machine = db.get(Machine, machine_id)
    if not machine:
        raise NotFoundException(f"Machine '{machine_id}' not found.")

    data = payload.model_dump(exclude={"timestamp"})
    reading = SensorReading(
        machine_id=machine_id,
        **data,
        timestamp=payload.timestamp or datetime.utcnow(),
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


@router.get(
    "/{machine_id}/sensor-readings",
    response_model=SensorReadingListResponse,
    summary="Get historical sensor readings for a machine",
)
def list_sensor_readings(
    machine_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    from_ts: Optional[datetime] = Query(default=None, description="Filter readings from this timestamp"),
    to_ts: Optional[datetime] = Query(default=None, description="Filter readings up to this timestamp"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SensorReadingListResponse:
    """Return paginated historical sensor readings for a machine, newest first."""
    machine = db.get(Machine, machine_id)
    if not machine:
        raise NotFoundException(f"Machine '{machine_id}' not found.")

    query = db.query(SensorReading).filter(SensorReading.machine_id == machine_id)

    if from_ts:
        query = query.filter(SensorReading.timestamp >= from_ts)
    if to_ts:
        query = query.filter(SensorReading.timestamp <= to_ts)

    total = query.count()
    readings = (
        query.order_by(SensorReading.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return SensorReadingListResponse(
        total=total, page=page, page_size=page_size, items=readings
    )
