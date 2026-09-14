
"""Pydantic schemas for the complete 15-channel IIoT dataset."""
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator

BOUNDS = {
    "temperature": (-50.0, 500.0), "vibration": (0.0, 100.0), "pressure": (0.0, 1000.0),
    "humidity": (0.0, 100.0), "rotation_speed": (0.0, 100000.0), "voltage": (0.0, 10000.0),
    "current": (0.0, 1000.0), "oil_level": (0.0, 100.0), "load": (0.0, 10000.0),
    "motor_temperature": (-50.0, 500.0), "gearbox_temperature": (-50.0, 500.0),
    "sound_level": (0.0, 200.0), "fan_speed": (0.0, 100000.0),
    "reactive_power": (0.0, 10000.0), "active_power": (0.0, 10000.0),
}

class SensorReadingCreate(BaseModel):
    temperature: Optional[float] = Field(default=None)
    vibration: Optional[float] = Field(default=None)
    pressure: Optional[float] = Field(default=None)
    humidity: Optional[float] = Field(default=None)
    rotation_speed: Optional[float] = Field(default=None)
    voltage: Optional[float] = Field(default=None)
    current: Optional[float] = Field(default=None)
    oil_level: Optional[float] = Field(default=None)
    load: Optional[float] = Field(default=None)
    motor_temperature: Optional[float] = Field(default=None)
    gearbox_temperature: Optional[float] = Field(default=None)
    sound_level: Optional[float] = Field(default=None)
    fan_speed: Optional[float] = Field(default=None)
    reactive_power: Optional[float] = Field(default=None)
    active_power: Optional[float] = Field(default=None)
    # Legacy API fields accepted for existing clients.
    rpm: Optional[float] = Field(default=None)
    power_consumption: Optional[float] = Field(default=None)
    source: Optional[str] = Field(default="manual", max_length=60)
    timestamp: Optional[datetime] = None

    @model_validator(mode="after")
    def at_least_one_channel(self):
        channels = [getattr(self, name) for name in list(BOUNDS) + ["rpm", "power_consumption"]]
        if all(v is None for v in channels):
            raise ValueError("At least one sensor channel must be provided.")
        return self

class SensorReadingResponse(BaseModel):
    id: uuid.UUID
    machine_id: uuid.UUID
    temperature: Optional[float]
    vibration: Optional[float]
    pressure: Optional[float]
    humidity: Optional[float]
    rotation_speed: Optional[float]
    voltage: Optional[float]
    current: Optional[float]
    oil_level: Optional[float]
    load: Optional[float]
    motor_temperature: Optional[float]
    gearbox_temperature: Optional[float]
    sound_level: Optional[float]
    fan_speed: Optional[float]
    reactive_power: Optional[float]
    active_power: Optional[float]
    rpm: Optional[float]
    power_consumption: Optional[float]
    source: Optional[str]
    is_valid: bool
    timestamp: datetime
    model_config = {"from_attributes": True}

class SensorReadingListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[SensorReadingResponse]
