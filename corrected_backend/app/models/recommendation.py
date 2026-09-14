"""
Recommendation model — AI-generated maintenance recommendations.
Table: recommendations  (Section 11)
Fields: machine_id, prediction_id, recommendation, priority, status, created_at
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class RecommendationPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RecommendationStatus(str, enum.Enum):
    PENDING = "PENDING"
    REVIEWED = "REVIEWED"
    ACTIONED = "ACTIONED"
    DISMISSED = "DISMISSED"


class Recommendation(Base, UUIDMixin):
    """
    An AI-generated recommendation linked to a machine and optionally a prediction.

    Relationships:
        machine: The machine this recommendation is for.
        prediction: The ML prediction that triggered this recommendation.
    """
    __tablename__ = "recommendations"

    machine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    prediction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("predictions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # LLM outputs
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)

    # Retrieved RAG context summary (for auditability)
    rag_context_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    priority: Mapped[RecommendationPriority] = mapped_column(
        Enum(RecommendationPriority, name="recommendation_priority_enum"),
        nullable=False,
        default=RecommendationPriority.MEDIUM,
    )
    status: Mapped[RecommendationStatus] = mapped_column(
        Enum(RecommendationStatus, name="recommendation_status_enum"),
        nullable=False,
        default=RecommendationStatus.PENDING,
    )

    # LLM metadata
    llm_model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    prompt_tokens: Mapped[int | None] = mapped_column(nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    machine = relationship("Machine", back_populates="recommendations")
    prediction = relationship("Prediction", back_populates="recommendations")

    def __repr__(self) -> str:
        return (
            f"<Recommendation id={self.id} machine={self.machine_id} "
            f"priority={self.priority} status={self.status}>"
        )
