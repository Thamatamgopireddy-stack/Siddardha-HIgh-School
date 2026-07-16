from uuid import uuid4

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, SoftDeleteMixin, TimestampMixin


class TimetableEntry(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "timetable_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    class_id: Mapped[str] = mapped_column(String(36), ForeignKey("classes.id"))
    section_id: Mapped[str] = mapped_column(String(36), ForeignKey("sections.id"))
    subject_id: Mapped[str] = mapped_column(String(36), ForeignKey("subjects.id"))
    teacher_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    day_of_week: Mapped[str] = mapped_column(String(20))  # e.g., Monday, Tuesday
    start_time: Mapped[str] = mapped_column(String(10))   # e.g., 09:00 AM
    end_time: Mapped[str] = mapped_column(String(10))     # e.g., 09:45 AM
    room_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
