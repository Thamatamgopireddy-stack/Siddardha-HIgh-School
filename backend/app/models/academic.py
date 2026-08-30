from datetime import date
from uuid import uuid4

from sqlalchemy import Boolean, Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, SoftDeleteMixin, TimestampMixin


class AcademicYear(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "academic_years"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(20))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)


class SchoolClass(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "classes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(50))
    academic_year_id: Mapped[str] = mapped_column(String(36), ForeignKey("academic_years.id"))


class Section(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "sections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    class_id: Mapped[str] = mapped_column(String(36), ForeignKey("classes.id"))
    name: Mapped[str] = mapped_column(String(10))
    class_teacher_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)


class Subject(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "subjects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(String(20))
    academic_year_id: Mapped[str] = mapped_column(String(36), ForeignKey("academic_years.id"))
    subject_type: Mapped[str] = mapped_column(String(20), default="theory")
    is_language: Mapped[bool] = mapped_column(Boolean, default=False)
