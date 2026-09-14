"""
User model — authentication and role-based access control.
Table: users
"""
import enum
import uuid

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    MAINTENANCE_ENGINEER = "MAINTENANCE_ENGINEER"
    OPERATOR = "OPERATOR"


class User(Base, UUIDMixin, TimestampMixin):
    """
    Represents a system user.

    Relationships:
        maintenance_records: Records created/assigned to this user.
    """
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role_enum"),
        nullable=False,
        default=UserRole.OPERATOR,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    maintenance_records = relationship(
        "MaintenanceRecord", back_populates="technician_user", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role}>"
