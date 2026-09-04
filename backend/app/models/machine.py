"""
Machine model — industrial machine master data.
Table: machines
"""
import enum

from sqlalchemy import Date, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class MachineStatus(str, enum.Enum):
    OPERATIONAL = "OPERATIONAL"
    UNDER_MAINTENANCE = "UNDER_MAINTENANCE"
    FAULTY = "FAULTY"
    DECOMMISSIONED = "DECOMMISSIONED"


class Machine(Base, UUIDMixin, TimestampMixin):
    """
    Represents a physical industrial machine being monitored.

    Relationships:
        sensor_readings: Time-series readings from this machine.
        maintenance_records: Maintenance history for this machine.
        predictions: ML failure-risk predictions for this machine.
        anomalies: Detected anomalies for this machine.
        recommendations: AI-generated recommendations for this machine.
    """
    __tablename__ = "machines"

    machine_name: Mapped[str] = mapped_column(String(120), nullable=False)
    machine_type: Mapped[str] = mapped_column(String(80), nullable=False)
    location: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[MachineStatus] = mapped_column(
        Enum(MachineStatus, name="machine_status_enum"),
        nullable=False,
        default=MachineStatus.OPERATIONAL,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    installation_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    model_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    manufacturer: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # Relationships
    sensor_readings = relationship(
        "SensorReading", back_populates="machine",
        cascade="all, delete-orphan", lazy="select"
    )
    maintenance_records = relationship(
        "MaintenanceRecord", back_populates="machine",
        cascade="all, delete-orphan", lazy="select"
    )
    predictions = relationship(
        "Prediction", back_populates="machine",
        cascade="all, delete-orphan", lazy="select"
    )
    anomalies = relationship(
        "Anomaly", back_populates="machine",
        cascade="all, delete-orphan", lazy="select"
    )
    recommendations = relationship(
        "Recommendation", back_populates="machine",
        cascade="all, delete-orphan", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Machine id={self.id} name={self.machine_name} status={self.status}>"
