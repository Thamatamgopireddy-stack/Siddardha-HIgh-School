from datetime import date
from uuid import uuid4

from sqlalchemy import Date, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, SoftDeleteMixin, TimestampMixin
from app.core.enums import AttendanceStatus


class Attendance(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "attendance"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"))
    section_id: Mapped[str] = mapped_column(String(36), ForeignKey("sections.id"))
    academic_year_id: Mapped[str] = mapped_column(String(36), ForeignKey("academic_years.id"))
    date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[AttendanceStatus] = mapped_column(Enum(AttendanceStatus, name="attendance_status"))
    marked_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
