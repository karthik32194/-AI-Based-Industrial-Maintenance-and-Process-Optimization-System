"""
Maintenance Records API — Section 7.4
Endpoints:
  POST  /api/machines/{id}/maintenance                     — create record
  GET   /api/machines/{id}/maintenance                     — list history
  GET   /api/machines/{id}/maintenance/{record_id}         — get single record
  PATCH /api/machines/{id}/maintenance/{record_id}         — update record
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_maintenance_engineer_or_admin
from app.core.exceptions import NotFoundException
from app.db.session import get_db
from app.models.machine import Machine
from app.models.maintenance_record import MaintenanceRecord, MaintenanceStatus, MaintenanceType
from app.models.user import User
from app.schemas.maintenance_record import (
    MaintenanceRecordCreate,
    MaintenanceRecordListResponse,
    MaintenanceRecordResponse,
    MaintenanceRecordUpdate,
)

router = APIRouter(prefix="/machines", tags=["Maintenance"])


@router.post(
    "/{machine_id}/maintenance",
    response_model=MaintenanceRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a maintenance record for a machine",
)
def create_maintenance_record(
    machine_id: uuid.UUID,
    payload: MaintenanceRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_maintenance_engineer_or_admin),
) -> MaintenanceRecordResponse:
    """
    Log a new preventive or corrective maintenance activity.
    If technician_id is not provided, defaults to the authenticated user.
    """
    machine = db.get(Machine, machine_id)
    if not machine:
        raise NotFoundException(f"Machine '{machine_id}' not found.")

    data = payload.model_dump()
    # Default technician to the calling user if not explicitly set
    if data.get("technician_id") is None:
        data["technician_id"] = current_user.id
    if data.get("technician_name") is None:
        data["technician_name"] = current_user.name

    record = MaintenanceRecord(machine_id=machine_id, **data)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get(
    "/{machine_id}/maintenance",
    response_model=MaintenanceRecordListResponse,
    summary="List maintenance history for a machine",
)
def list_maintenance_records(
    machine_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    maintenance_type: Optional[MaintenanceType] = Query(default=None),
    record_status: Optional[MaintenanceStatus] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> MaintenanceRecordListResponse:
    """Return paginated maintenance history, newest first."""
    machine = db.get(Machine, machine_id)
    if not machine:
        raise NotFoundException(f"Machine '{machine_id}' not found.")

    query = db.query(MaintenanceRecord).filter(
        MaintenanceRecord.machine_id == machine_id
    )
    if maintenance_type:
        query = query.filter(MaintenanceRecord.maintenance_type == maintenance_type)
    if record_status:
        query = query.filter(MaintenanceRecord.status == record_status)

    total = query.count()
    records = (
        query.order_by(MaintenanceRecord.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return MaintenanceRecordListResponse(
        total=total, page=page, page_size=page_size, items=records
    )


@router.get(
    "/{machine_id}/maintenance/{record_id}",
    response_model=MaintenanceRecordResponse,
    summary="Get a single maintenance record",
)
def get_maintenance_record(
    machine_id: uuid.UUID,
    record_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> MaintenanceRecordResponse:
    """Return details of a specific maintenance record."""
    record = (
        db.query(MaintenanceRecord)
        .filter(
            MaintenanceRecord.id == record_id,
            MaintenanceRecord.machine_id == machine_id,
        )
        .first()
    )
    if not record:
        raise NotFoundException(f"Maintenance record '{record_id}' not found.")
    return record


@router.patch(
    "/{machine_id}/maintenance/{record_id}",
    response_model=MaintenanceRecordResponse,
    summary="Update a maintenance record",
)
def update_maintenance_record(
    machine_id: uuid.UUID,
    record_id: uuid.UUID,
    payload: MaintenanceRecordUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_maintenance_engineer_or_admin),
) -> MaintenanceRecordResponse:
    """Partially update a maintenance record — e.g. mark as COMPLETED, add findings."""
    record = (
        db.query(MaintenanceRecord)
        .filter(
            MaintenanceRecord.id == record_id,
            MaintenanceRecord.machine_id == machine_id,
        )
        .first()
    )
    if not record:
        raise NotFoundException(f"Maintenance record '{record_id}' not found.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record
