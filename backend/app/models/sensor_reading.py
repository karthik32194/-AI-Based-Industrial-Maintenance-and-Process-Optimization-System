"""
SensorReading model — historical sensor data per machine.
Table: sensor_readings
Fields: temperature, vibration, pressure, rpm, power_consumption (Section 7.3)
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class SensorReading(Base, UUIDMixin):
    """
    One time-stamped sensor reading from a machine.

    All five primary sensor channels from the document are stored:
    temperature, vibration, pressure, rpm, power_consumption.
    """
    __tablename__ = "sensor_readings"

    machine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Sensor channels (Section 7.3)
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)        # °C
    vibration: Mapped[float | None] = mapped_column(Float, nullable=True)          # mm/s
    pressure: Mapped[float | None] = mapped_column(Float, nullable=True)           # bar
    rpm: Mapped[float | None] = mapped_column(Float, nullable=True)                # rotations/min
    power_consumption: Mapped[float | None] = mapped_column(Float, nullable=True)  # kW

    # Source / quality metadata
    source: Mapped[str | None] = mapped_column(String(60), nullable=True)          # e.g. "iot", "manual"
    is_valid: Mapped[bool] = mapped_column(default=True, nullable=False)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    machine = relationship("Machine", back_populates="sensor_readings")

    def __repr__(self) -> str:
        return (
            f"<SensorReading machine={self.machine_id} "
            f"temp={self.temperature} vib={self.vibration} ts={self.timestamp}>"
        )
