"""
Pydantic schemas for MaintenanceRecord — Section 7.4.
Covers preventive and corrective maintenance.
"""
import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.maintenance_record import MaintenanceType, MaintenanceStatus


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class MaintenanceRecordCreate(BaseModel):
    """Payload for POST /api/machines/{id}/maintenance."""
    maintenance_type: MaintenanceType
    status: MaintenanceStatus = MaintenanceStatus.SCHEDULED
    technician_name: Optional[str] = Field(default=None, max_length=120)
    technician_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    findings: Optional[str] = None
    actions_taken: Optional[str] = None
    maintenance_date: Optional[date] = None
    completed_date: Optional[date] = None


class MaintenanceRecordUpdate(BaseModel):
    """Payload for PATCH /api/machines/{id}/maintenance/{record_id}."""
    status: Optional[MaintenanceStatus] = None
    technician_name: Optional[str] = Field(default=None, max_length=120)
    technician_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    findings: Optional[str] = None
    actions_taken: Optional[str] = None
    maintenance_date: Optional[date] = None
    completed_date: Optional[date] = None


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class MaintenanceRecordResponse(BaseModel):
    """Full maintenance record representation."""
    id: uuid.UUID
    machine_id: uuid.UUID
    maintenance_type: MaintenanceType
    status: MaintenanceStatus
    technician_name: Optional[str]
    technician_id: Optional[uuid.UUID]
    description: Optional[str]
    findings: Optional[str]
    actions_taken: Optional[str]
    maintenance_date: Optional[date]
    completed_date: Optional[date]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceRecordListResponse(BaseModel):
    """Paginated list of maintenance records."""
    total: int
    page: int
    page_size: int
    items: List[MaintenanceRecordResponse]
