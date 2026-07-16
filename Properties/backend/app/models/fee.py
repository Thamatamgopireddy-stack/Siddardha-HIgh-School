from datetime import date
from uuid import uuid4

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, SoftDeleteMixin, TimestampMixin


class FeeStructure(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "fee_structures"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    academic_year_id: Mapped[str] = mapped_column(String(36), ForeignKey("academic_years.id"))
    name: Mapped[str] = mapped_column(String(100))
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    frequency: Mapped[str] = mapped_column(String(20))
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=True)


class FeePayment(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "fee_payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"))
    fee_structure_id: Mapped[str] = mapped_column(String(36), ForeignKey("fee_structures.id"))
    amount_paid: Mapped[float] = mapped_column(Numeric(10, 2))
    payment_date: Mapped[date] = mapped_column(Date)
    receipt_number: Mapped[str] = mapped_column(String(50), unique=True)
