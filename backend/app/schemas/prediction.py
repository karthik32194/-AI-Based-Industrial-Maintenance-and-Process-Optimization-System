"""
Pydantic schemas for ML Prediction results — Section 7.5, Phase 5 contract.

Exposes the honest Phase 4 outputs: failure_risk_score (risk score, NOT a
calibrated probability), risk_flag, health_score (derived), and ml_status
(VALID / UNAVAILABLE). See app.models.prediction for field semantics.
"""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Response schemas (predictions are created internally by the ML pipeline)
# ---------------------------------------------------------------------------

class PredictionResponse(BaseModel):
    """Full prediction result representation."""
    id: uuid.UUID
    machine_id: uuid.UUID

    # ML outputs (Phase 4 honest contract)
    # failure_risk_score is a continuous risk score (higher = larger failure-risk
    # ranking), NOT a calibrated probability of failure. Null when ML unavailable.
    failure_risk_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    risk_flag: Optional[bool]
    health_score: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    anomaly_detected: bool

    # ML availability (Phase 5, Step 5 HARD): "VALID" or "UNAVAILABLE".
    ml_status: str
    ml_error: Optional[str]

    # Model metadata
    model_version: Optional[str]

    # Input snapshot (15 channels, for traceability)
    input_temperature: Optional[float]
    input_vibration: Optional[float]
    input_pressure: Optional[float]
    input_rpm: Optional[float]
    input_power_consumption: Optional[float]
    input_humidity: Optional[float]
    input_voltage: Optional[float]
    input_current: Optional[float]
    input_oil_level: Optional[float]
    input_load: Optional[float]
    input_motor_temperature: Optional[float]
    input_gearbox_temperature: Optional[float]
    input_sound_level: Optional[float]
    input_fan_speed: Optional[float]
    input_reactive_power: Optional[float]

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
    All 15 channels are optional.
    """
    temperature: Optional[float] = None
    vibration: Optional[float] = None
    pressure: Optional[float] = None
    rpm: Optional[float] = None
    power_consumption: Optional[float] = None
    humidity: Optional[float] = None
    voltage: Optional[float] = None
    current: Optional[float] = None
    oil_level: Optional[float] = None
    load: Optional[float] = None
    motor_temperature: Optional[float] = None
    gearbox_temperature: Optional[float] = None
    sound_level: Optional[float] = None
    fan_speed: Optional[float] = None
    reactive_power: Optional[float] = None