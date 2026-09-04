"""
Pydantic schemas for SensorReading — Section 7.3.
Stores temperature, vibration, pressure, RPM, power consumption.
"""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class SensorReadingCreate(BaseModel):
    """
    Payload for POST /api/machines/{id}/sensor-readings.
    At least one sensor channel must be provided.
    """
    temperature: Optional[float] = Field(default=None, ge=-50.0, le=500.0, description="Temperature in °C")
    vibration: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Vibration in mm/s")
    pressure: Optional[float] = Field(default=None, ge=0.0, le=1000.0, description="Pressure in bar")
    rpm: Optional[float] = Field(default=None, ge=0.0, le=100000.0, description="Rotations per minute")
    power_consumption: Optional[float] = Field(default=None, ge=0.0, le=10000.0, description="Power in kW")
    source: Optional[str] = Field(default="manual", max_length=60)
    timestamp: Optional[datetime] = None

    @model_validator(mode="after")
    def at_least_one_channel(self) -> "SensorReadingCreate":
        channels = [
            self.temperature, self.vibration,
            self.pressure, self.rpm, self.power_consumption
        ]
        if all(v is None for v in channels):
            raise ValueError("At least one sensor channel must be provided.")
        return self


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class SensorReadingResponse(BaseModel):
    """Full sensor reading representation."""
    id: uuid.UUID
    machine_id: uuid.UUID
    temperature: Optional[float]
    vibration: Optional[float]
    pressure: Optional[float]
    rpm: Optional[float]
    power_consumption: Optional[float]
    source: Optional[str]
    is_valid: bool
    timestamp: datetime

    model_config = {"from_attributes": True}


class SensorReadingListResponse(BaseModel):
    """Paginated list of sensor readings."""
    total: int
    page: int
    page_size: int
    items: List[SensorReadingResponse]
