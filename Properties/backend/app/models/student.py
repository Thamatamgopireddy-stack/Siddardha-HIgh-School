from datetime import date
from uuid import uuid4

from sqlalchemy import Boolean, Date, Enum, ForeignKey, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin, TimestampMixin
from app.core.enums import Category, Gender


class Student(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "students"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    admission_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    academic_year_id: Mapped[str] = mapped_column(String(36), ForeignKey("academic_years.id"))
    first_name: Mapped[str] = mapped_column(String(100))
    middle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str] = mapped_column(String(100))
    date_of_birth: Mapped[date] = mapped_column(Date)
    gender: Mapped[Gender] = mapped_column(Enum(Gender, name="gender"))
    section_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("sections.id"), nullable=True)
    roll_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[Category | None] = mapped_column(Enum(Category, name="category"), nullable=True)

    # Missing fields from SRS
    profile_photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    blood_group: Mapped[str | None] = mapped_column(String(10), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(50), default="Indian", nullable=True)
    religion: Mapped[str | None] = mapped_column(String(50), nullable=True)
    aadhaar_number: Mapped[str | None] = mapped_column(String(255), nullable=True)
    previous_school: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tc_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    admission_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Address
    address_line1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(15), nullable=True)
    alternate_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Relationships
    documents = relationship("StudentDocument", back_populates="student", cascade="all, delete-orphan")


class StudentDocument(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "student_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"))
    document_type: Mapped[str] = mapped_column(String(50))  # e.g., Birth Certificate, Aadhaar, TC, Marksheet
    file_url: Mapped[str] = mapped_column(String(500))
    file_name: Mapped[str] = mapped_column(String(255))

    student = relationship("Student", back_populates="documents")
