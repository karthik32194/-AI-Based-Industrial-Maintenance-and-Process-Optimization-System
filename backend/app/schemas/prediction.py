"""
Pydantic schemas for ML Prediction results — Section 7.5.
"""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.prediction import RiskLevel, MachineHealthStatus


# ---------------------------------------------------------------------------
# Response schemas (predictions are created internally by the ML pipeline)
# ---------------------------------------------------------------------------

class PredictionResponse(BaseModel):
    """Full prediction result representation."""
    id: uuid.UUID
    machine_id: uuid.UUID

    # ML outputs
    failure_probability: float = Field(..., ge=0.0, le=1.0)
    predicted_failure: Optional[str]
    risk_level: RiskLevel
    health_status: MachineHealthStatus
    health_score: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    anomaly_detected: bool

    # Model metadata
    model_version: str

    # Input snapshot
    input_temperature: Optional[float]
    input_vibration: Optional[float]
    input_pressure: Optional[float]
    input_rpm: Optional[float]
    input_power_consumption: Optional[float]

    created_at: datetime

    model_config = {"from_attributes": True}


class PredictionListResponse(BaseModel):
    """Paginated list of predictions."""
    total: int
    page: int
    page_size: int
    items: List[PredictionResponse]


class PredictRequest(BaseModel):
    """
    Optional override payload for POST /api/machines/{id}/predict.
    If omitted, the service uses the latest stored sensor reading.
    """
    temperature: Optional[float] = None
    vibration: Optional[float] = None
    pressure: Optional[float] = None
    rpm: Optional[float] = None
    power_consumption: Optional[float] = None
