from datetime import date
from uuid import uuid4
from sqlalchemy import ForeignKey, String, Date, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin, TimestampMixin


class Assignment(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    section_id: Mapped[str] = mapped_column(String(36), ForeignKey("sections.id"))
    subject_id: Mapped[str] = mapped_column(String(36), ForeignKey("subjects.id"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[date] = mapped_column(Date)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    submissions = relationship("AssignmentSubmission", back_populates="assignment", cascade="all, delete-orphan")


class AssignmentSubmission(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "assignment_submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    assignment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assignments.id"))
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"))
    submission_date: Mapped[date] = mapped_column(Date)
    file_url: Mapped[str] = mapped_column(String(500))
    marks_obtained: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    feedback: Mapped[str | None] = mapped_column(String(255), nullable=True)

    assignment = relationship("Assignment", back_populates="submissions")
