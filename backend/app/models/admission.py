from datetime import date
from uuid import uuid4

from sqlalchemy import Date, Enum, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, SoftDeleteMixin, TimestampMixin
from app.core.enums import AdmissionStatus, Gender


class Admission(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "admissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    academic_year_id: Mapped[str] = mapped_column(String(36), ForeignKey("academic_years.id"))
    applying_for_class_id: Mapped[str] = mapped_column(String(36), ForeignKey("classes.id"))
    applicant_name: Mapped[str] = mapped_column(String(200))
    date_of_birth: Mapped[date] = mapped_column(Date)
    gender: Mapped[Gender] = mapped_column(Enum(Gender, name="gender_adm"))
    phone: Mapped[str] = mapped_column(String(20))
    status: Mapped[AdmissionStatus] = mapped_column(Enum(AdmissionStatus, name="admission_status"))
    application_date: Mapped[date] = mapped_column(Date)
    documents: Mapped[dict | None] = mapped_column(JSON, nullable=True)
