"""
Maintenance Service — Section 15
Business logic for preventive and corrective maintenance records.
"""
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.core.logging import get_logger
from app.models.machine import Machine
from app.models.maintenance_record import MaintenanceRecord
from app.models.user import User
from app.schemas.maintenance_record import MaintenanceRecordCreate, MaintenanceRecordUpdate

logger = get_logger(__name__)


def create_maintenance_record(
    machine_id: uuid.UUID,
    payload: MaintenanceRecordCreate,
    db: Session,
    created_by: User | None = None,
) -> MaintenanceRecord:
    machine = db.get(Machine, machine_id)
    if not machine:
        raise NotFoundException(f"Machine '{machine_id}' not found.")

    data = payload.model_dump()
    if created_by and data.get("technician_id") is None:
        data["technician_id"] = created_by.id
    if created_by and data.get("technician_name") is None:
        data["technician_name"] = created_by.name

    record = MaintenanceRecord(machine_id=machine_id, **data)
    db.add(record)
    db.commit()
    db.refresh(record)
    logger.info("maintenance_record_created", machine_id=str(machine_id), record_id=str(record.id))
    return record


def update_maintenance_record(
    record_id: uuid.UUID,
    payload: MaintenanceRecordUpdate,
    db: Session,
) -> MaintenanceRecord:
    record = db.get(MaintenanceRecord, record_id)
    if not record:
        raise NotFoundException(f"Maintenance record '{record_id}' not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    logger.info("maintenance_record_updated", record_id=str(record_id))
    return record
