"""
Anomaly model — detected abnormal behavior per machine.
Table: anomalies  (Section 11)
Fields: anomaly_score, anomaly_type, description, detected_at, status
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class AnomalyStatus(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    FALSE_POSITIVE = "FALSE_POSITIVE"


class Anomaly(Base, UUIDMixin):
    """
    Represents a single detected anomaly event for a machine.

    Relationships:
        machine: The machine where the anomaly was detected.
    """
    __tablename__ = "anomalies"

    machine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    anomaly_score: Mapped[float] = mapped_column(Float, nullable=False)
    anomaly_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Sensor values at detection time
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    vibration: Mapped[float | None] = mapped_column(Float, nullable=True)
    pressure: Mapped[float | None] = mapped_column(Float, nullable=True)
    rpm: Mapped[float | None] = mapped_column(Float, nullable=True)
    power_consumption: Mapped[float | None] = mapped_column(Float, nullable=True)

    status: Mapped[AnomalyStatus] = mapped_column(
        Enum(AnomalyStatus, name="anomaly_status_enum"),
        nullable=False,
        default=AnomalyStatus.OPEN,
    )

    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    machine = relationship("Machine", back_populates="anomalies")

    def __repr__(self) -> str:
        return (
            f"<Anomaly id={self.id} machine={self.machine_id} "
            f"score={self.anomaly_score:.3f} status={self.status}>"
        )
