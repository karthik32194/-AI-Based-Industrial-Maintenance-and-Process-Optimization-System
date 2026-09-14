"""
Pydantic schemas for AI Recommendations — Section 7.6.
"""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.recommendation import RecommendationPriority, RecommendationStatus


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class RecommendationRequest(BaseModel):
    """
    Payload for POST /api/machines/{id}/recommendation.
    Optionally reference a specific prediction; defaults to latest.
    """
    prediction_id: Optional[uuid.UUID] = None
    additional_context: Optional[str] = None


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class RecommendationResponse(BaseModel):
    """Full AI recommendation representation."""
    id: uuid.UUID
    machine_id: uuid.UUID
    prediction_id: Optional[uuid.UUID]
    explanation: Optional[str]
    recommendation: str
    rag_context_summary: Optional[str]
    priority: RecommendationPriority
    status: RecommendationStatus
    llm_model: Optional[str]
    prompt_tokens: Optional[int]
    completion_tokens: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class RecommendationListResponse(BaseModel):
    """Paginated list of recommendations."""
    total: int
    page: int
    page_size: int
    items: List[RecommendationResponse]


class RecommendationStatusUpdate(BaseModel):
    """Payload for updating recommendation status after human review."""
    status: RecommendationStatus
