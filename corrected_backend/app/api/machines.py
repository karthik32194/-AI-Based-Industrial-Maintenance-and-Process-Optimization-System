"""
Machine Management API — Section 7.2
Endpoints:
  POST   /api/machines            — create machine (admin)
  GET    /api/machines            — list machines with search/filter
  GET    /api/machines/{id}       — get single machine
  PUT    /api/machines/{id}       — update machine (admin/engineer)
  DELETE /api/machines/{id}       — deactivate machine (admin)
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    require_admin,
    require_maintenance_engineer_or_admin,
)
from app.db.session import get_db
from app.models.machine import Machine, MachineStatus
from app.models.user import User
from app.schemas.machine import (
    MachineCreate,
    MachineListResponse,
    MachineResponse,
    MachineUpdate,
)
from app.core.exceptions import NotFoundException

router = APIRouter(prefix="/machines", tags=["Machines"])


@router.post(
    "",
    response_model=MachineResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new machine",
)
def create_machine(
    payload: MachineCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> MachineResponse:
    """Create a machine record. Restricted to ADMIN."""
    machine = Machine(**payload.model_dump())
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return machine


@router.get(
    "",
    response_model=MachineListResponse,
    summary="List machines with optional search and filter",
)
def list_machines(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None, description="Search by machine name or type"),
    status_filter: Optional[MachineStatus] = Query(default=None, alias="status"),
    location: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> MachineListResponse:
    """Return a paginated, filterable list of all machines."""
    query = db.query(Machine)

    if search:
        like = f"%{search}%"
        query = query.filter(
            Machine.machine_name.ilike(like) | Machine.machine_type.ilike(like)
        )
    if status_filter:
        query = query.filter(Machine.status == status_filter)
    if location:
        query = query.filter(Machine.location.ilike(f"%{location}%"))

    total = query.count()
    machines = (
        query.order_by(Machine.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return MachineListResponse(total=total, page=page, page_size=page_size, items=machines)


@router.get(
    "/{machine_id}",
    response_model=MachineResponse,
    summary="Get a single machine by ID",
)
def get_machine(
    machine_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> MachineResponse:
    """Return detailed information for a single machine."""
    machine = db.get(Machine, machine_id)
    if not machine:
        raise NotFoundException(f"Machine '{machine_id}' not found.")
    return machine


@router.put(
    "/{machine_id}",
    response_model=MachineResponse,
    summary="Update machine details",
)
def update_machine(
    machine_id: uuid.UUID,
    payload: MachineUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_maintenance_engineer_or_admin),
) -> MachineResponse:
    """Update one or more fields on a machine. Partial updates supported."""
    machine = db.get(Machine, machine_id)
    if not machine:
        raise NotFoundException(f"Machine '{machine_id}' not found.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(machine, field, value)

    db.commit()
    db.refresh(machine)
    return machine


@router.delete(
    "/{machine_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deactivate (soft-delete) a machine",
)
def deactivate_machine(
    machine_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    """
    Set machine status to DECOMMISSIONED.
    This is a soft deactivation — data is preserved.
    """
    machine = db.get(Machine, machine_id)
    if not machine:
        raise NotFoundException(f"Machine '{machine_id}' not found.")

    machine.status = MachineStatus.DECOMMISSIONED
    db.commit()
