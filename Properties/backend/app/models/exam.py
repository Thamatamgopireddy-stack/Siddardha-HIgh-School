from datetime import date
from uuid import uuid4
from sqlalchemy import Boolean, ForeignKey, String, Date, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin, TimestampMixin


class Exam(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "exams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    academic_year_id: Mapped[str] = mapped_column(String(36), ForeignKey("academic_years.id"))
    name: Mapped[str] = mapped_column(String(100))
    exam_type: Mapped[str] = mapped_column(String(20))
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)

    schedules = relationship("ExamSchedule", back_populates="exam", cascade="all, delete-orphan")


class ExamSchedule(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "exam_schedules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    exam_id: Mapped[str] = mapped_column(String(36), ForeignKey("exams.id"))
    subject_id: Mapped[str] = mapped_column(String(36), ForeignKey("subjects.id"))
    section_id: Mapped[str] = mapped_column(String(36), ForeignKey("sections.id"))
    exam_date: Mapped[date] = mapped_column(Date)
    max_marks: Mapped[float] = mapped_column(Numeric(5, 2), default=100.0)
    pass_marks: Mapped[float] = mapped_column(Numeric(5, 2), default=33.0)

    exam = relationship("Exam", back_populates="schedules")
    marks = relationship("ExamMark", back_populates="schedule", cascade="all, delete-orphan")


class ExamMark(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "exam_marks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    exam_schedule_id: Mapped[str] = mapped_column(String(36), ForeignKey("exam_schedules.id"))
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"))
    marks_obtained: Mapped[float] = mapped_column(Numeric(5, 2))
    remarks: Mapped[str | None] = mapped_column(String(255), nullable=True)

    schedule = relationship("ExamSchedule", back_populates="marks")
