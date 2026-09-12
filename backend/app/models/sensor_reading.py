"""
SensorReading model — historical sensor data per machine.
Table: sensor_readings
Fields: 15 industrial channels (5 canonical + 10 raw), Section 7.3 + Phase 5.

Phase 5 expands storage from 5 to all 15 channels the ML artifacts consume
(refer to app.ml.contract.FAILURE_SENSOR_COLUMNS). The first five use the
canonical names (rpm, power_consumption); the remaining ten are stored under
their dataset names because the contract provides no canonical alias for them.
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

    All 15 channels the Phase 3/Phase 4 ML artifacts consume are stored:
    the five canonical channels (temperature, vibration, pressure, rpm,
    power_consumption) plus the ten raw dataset channels (humidity, voltage,
    current, oil_level, load, motor_temperature, gearbox_temperature,
    sound_level, fan_speed, reactive_power).
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

    # Raw dataset channels (Phase 5; no canonical alias, dataset names preserved)
    humidity: Mapped[float | None] = mapped_column(Float, nullable=True)
    voltage: Mapped[float | None] = mapped_column(Float, nullable=True)
    current: Mapped[float | None] = mapped_column(Float, nullable=True)
    oil_level: Mapped[float | None] = mapped_column(Float, nullable=True)
    load: Mapped[float | None] = mapped_column(Float, nullable=True)
    motor_temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    gearbox_temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    sound_level: Mapped[float | None] = mapped_column(Float, nullable=True)
    fan_speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    reactive_power: Mapped[float | None] = mapped_column(Float, nullable=True)

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
