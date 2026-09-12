"""
Prediction model — ML failure-risk prediction history.
Table: predictions  (Section 11)

Phase 5 replaces the old probability/risk-category fields with the honest
Phase 4 contract:
  * failure_risk_score  — continuous risk score (0..1), NOT a calibrated
                          probability of failure.
  * risk_flag           — score >= threshold (stored operating point, default 0.15).
  * ml_status           — VALID if both models produced results; UNAVAILABLE if
                          a required ML artifact was missing/corrupt. An
                          UNAVAILABLE record carries no score/flag and must
                          never be treated as healthy.
  * health_score        — derived software indicator (presentation layer), not
                          a validated physical health metric.

Old columns failure_probability / predicted_failure / risk_level / health_status
were removed (their semantics were not defensible under the Phase 4 contract).
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

# ml_status values (see app.ml.service).
ML_STATUS_VALID = "VALID"
ML_STATUS_UNAVAILABLE = "UNAVAILABLE"


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

    # ML outputs (Phase 4 honest contract)
    # failure_risk_score is the continuous risk score, NOT a calibrated
    # probability of failure. Null when ML is unavailable.
    failure_risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    # risk_flag = failure_risk_score >= threshold (0.15 default). Null when
    # ML is unavailable.
    risk_flag: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    # Derived software indicator (0-100), presentation-layer only.
    health_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    anomaly_detected: Mapped[bool] = mapped_column(default=False, nullable=False)

    # ML availability (Phase 5, Step 5 HARD): UNAVAILABLE when an artifact was
    # missing/corrupt/incompatible. Never silently healthy.
    ml_status: Mapped[str] = mapped_column(String(20), nullable=False, default=ML_STATUS_VALID)
    ml_error: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Model metadata
    model_version: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # Input snapshot (15 channels, for traceability)
    input_temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_vibration: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_pressure: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_rpm: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_power_consumption: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_humidity: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_voltage: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_current: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_oil_level: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_load: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_motor_temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_gearbox_temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_sound_level: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_fan_speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_reactive_power: Mapped[float | None] = mapped_column(Float, nullable=True)

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
            f"ml_status={self.ml_status} risk_score={self.failure_risk_score}>"
        )