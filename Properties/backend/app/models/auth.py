from uuid import uuid4

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, SoftDeleteMixin, TimestampMixin
from app.core.enums import UserRole


class Permission(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "permissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)


class RolePermission(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "role_permissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role_perm"))
    permission_id: Mapped[str] = mapped_column(String(36), ForeignKey("permissions.id"))


class PasswordHistory(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "password_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    password_hash: Mapped[str] = mapped_column(String(255))
