"""
MaintenanceRecord model — preventive and corrective maintenance history.
Table: maintenance_records  (Section 7.4 / Section 11)
"""
import enum
import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class MaintenanceType(str, enum.Enum):
    PREVENTIVE = "PREVENTIVE"
    CORRECTIVE = "CORRECTIVE"


class MaintenanceStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class MaintenanceRecord(Base, UUIDMixin, TimestampMixin):
    """
    Represents one maintenance activity on a machine.

    Relationships:
        machine: The machine this record belongs to.
        technician_user: The user (engineer) who performed the work.
    """
    __tablename__ = "maintenance_records"

    machine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Technician may be a free-text name or linked to a user
    technician_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    technician_name: Mapped[str | None] = mapped_column(String(120), nullable=True)

    maintenance_type: Mapped[MaintenanceType] = mapped_column(
        Enum(MaintenanceType, name="maintenance_type_enum"),
        nullable=False,
    )
    status: Mapped[MaintenanceStatus] = mapped_column(
        Enum(MaintenanceStatus, name="maintenance_status_enum"),
        nullable=False,
        default=MaintenanceStatus.SCHEDULED,
    )

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    findings: Mapped[str | None] = mapped_column(Text, nullable=True)
    actions_taken: Mapped[str | None] = mapped_column(Text, nullable=True)

    maintenance_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Relationships
    machine = relationship("Machine", back_populates="maintenance_records")
    technician_user = relationship("User", back_populates="maintenance_records")

    def __repr__(self) -> str:
        return (
            f"<MaintenanceRecord id={self.id} machine={self.machine_id} "
            f"type={self.maintenance_type} status={self.status}>"
        )
