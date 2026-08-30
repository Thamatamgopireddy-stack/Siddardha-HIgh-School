from datetime import date
from uuid import uuid4

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, SoftDeleteMixin, TimestampMixin


class FeeStructure(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "fee_structures"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    academic_year_id: Mapped[str] = mapped_column(String(36), ForeignKey("academic_years.id"))
    class_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("classes.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(100))
    fee_head: Mapped[str] = mapped_column(String(50), default="Tuition Fee")
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    frequency: Mapped[str] = mapped_column(String(20))
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=True)


class FeeInvoice(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "fee_invoices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"))
    fee_structure_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("fee_structures.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(150))
    amount_due: Mapped[float] = mapped_column(Numeric(10, 2))
    amount_paid: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    due_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="unpaid")  # unpaid, partial, paid, overdue


class FeePayment(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "fee_payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"))
    fee_structure_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("fee_structures.id"), nullable=True)
    invoice_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("fee_invoices.id"), nullable=True)
    amount_paid: Mapped[float] = mapped_column(Numeric(10, 2))
    payment_date: Mapped[date] = mapped_column(Date, default=date.today)
    payment_method: Mapped[str] = mapped_column(String(36), default="cash")
    transaction_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    receipt_number: Mapped[str] = mapped_column(String(50), unique=True)
    paid_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
