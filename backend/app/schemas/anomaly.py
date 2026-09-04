"""
Pydantic schemas for Anomaly — Section 7.5 / Section 11.
"""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.anomaly import AnomalyStatus


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class AnomalyResponse(BaseModel):
    """Full anomaly event representation."""
    id: uuid.UUID
    machine_id: uuid.UUID
    anomaly_score: float
    anomaly_type: Optional[str]
    description: Optional[str]
    temperature: Optional[float]
    vibration: Optional[float]
    pressure: Optional[float]
    rpm: Optional[float]
    power_consumption: Optional[float]
    status: AnomalyStatus
    detected_at: datetime

    model_config = {"from_attributes": True}


class AnomalyListResponse(BaseModel):
    """Paginated list of anomalies."""
    total: int
    page: int
    page_size: int
    items: List[AnomalyResponse]


class AnomalyStatusUpdate(BaseModel):
    """Payload for updating anomaly status (e.g., mark as resolved)."""
    status: AnomalyStatus
