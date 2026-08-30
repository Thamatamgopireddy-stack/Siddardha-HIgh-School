from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, SoftDeleteMixin, TimestampMixin
from app.core.enums import LeaveStatus


class LeaveApplication(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "leave_applications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    applicant_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    applicant_type: Mapped[str] = mapped_column(String(20))
    leave_type: Mapped[str] = mapped_column(String(20))
    from_date: Mapped[date] = mapped_column(Date)
    to_date: Mapped[date] = mapped_column(Date)
    days: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[LeaveStatus] = mapped_column(Enum(LeaveStatus, name="leave_status"))
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
