"""
Prediction model — ML failure-risk prediction history.
Table: predictions  (Section 11)
Fields: failure_probability, predicted_failure, risk_level, model_version
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class MachineHealthStatus(str, enum.Enum):
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    AT_RISK = "AT_RISK"
    CRITICAL = "CRITICAL"


class Prediction(Base, UUIDMixin):
    """
    One ML inference result for a machine.

    Relationships:
        machine: The machine this prediction belongs to.
        recommendations: AI recommendations generated from this prediction.
    """
    __tablename__ = "predictions"

    machine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ML outputs
    failure_probability: Mapped[float] = mapped_column(Float, nullable=False)
    predicted_failure: Mapped[str | None] = mapped_column(String(120), nullable=True)
    risk_level: Mapped[RiskLevel] = mapped_column(
        Enum(RiskLevel, name="risk_level_enum"),
        nullable=False,
    )
    health_status: Mapped[MachineHealthStatus] = mapped_column(
        Enum(MachineHealthStatus, name="health_status_enum"),
        nullable=False,
        default=MachineHealthStatus.HEALTHY,
    )
    health_score: Mapped[float | None] = mapped_column(Float, nullable=True)   # 0-100
    anomaly_detected: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Model metadata
    model_version: Mapped[str] = mapped_column(String(40), nullable=False, default="v1.0")

    # Input snapshot (for traceability)
    input_temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_vibration: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_pressure: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_rpm: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_power_consumption: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    machine = relationship("Machine", back_populates="predictions")
    recommendations = relationship(
        "Recommendation", back_populates="prediction",
        cascade="all, delete-orphan", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<Prediction id={self.id} machine={self.machine_id} "
            f"prob={self.failure_probability:.2f} risk={self.risk_level}>"
        )
