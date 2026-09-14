"""
Pydantic schemas for Machine CRUD — Section 7.2.
"""
import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.machine import MachineStatus


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class MachineCreate(BaseModel):
    """Payload for POST /api/machines."""
    machine_name: str = Field(..., min_length=1, max_length=120)
    machine_type: str = Field(..., min_length=1, max_length=80)
    location: str = Field(..., min_length=1, max_length=120)
    status: MachineStatus = MachineStatus.OPERATIONAL
    description: Optional[str] = None
    installation_date: Optional[date] = None
    model_number: Optional[str] = Field(default=None, max_length=80)
    manufacturer: Optional[str] = Field(default=None, max_length=120)


class MachineUpdate(BaseModel):
    """Payload for PUT /api/machines/{id} — all fields optional."""
    machine_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    machine_type: Optional[str] = Field(default=None, max_length=80)
    location: Optional[str] = Field(default=None, max_length=120)
    status: Optional[MachineStatus] = None
    description: Optional[str] = None
    installation_date: Optional[date] = None
    model_number: Optional[str] = Field(default=None, max_length=80)
    manufacturer: Optional[str] = Field(default=None, max_length=120)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class MachineResponse(BaseModel):
    """Full machine representation."""
    id: uuid.UUID
    machine_name: str
    machine_type: str
    location: str
    status: MachineStatus
    description: Optional[str]
    installation_date: Optional[date]
    model_number: Optional[str]
    manufacturer: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MachineListResponse(BaseModel):
    """Paginated list of machines."""
    total: int
    page: int
    page_size: int
    items: List[MachineResponse]
