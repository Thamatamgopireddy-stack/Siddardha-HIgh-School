from datetime import date
from uuid import uuid4

from sqlalchemy import Date, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, SoftDeleteMixin, TimestampMixin


class SalaryStructure(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "salary_structures"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    staff_id: Mapped[str] = mapped_column(String(36), ForeignKey("staff.id"), unique=True)
    base_salary: Mapped[float] = mapped_column(Float, default=0.0)
    allowances: Mapped[float] = mapped_column(Float, default=0.0)
    deductions: Mapped[float] = mapped_column(Float, default=0.0)


class MonthlyPayroll(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "monthly_payrolls"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    staff_id: Mapped[str] = mapped_column(String(36), ForeignKey("staff.id"))
    month: Mapped[int] = mapped_column(default=1)  # 1 to 12
    year: Mapped[int] = mapped_column(default=2026)
    net_salary: Mapped[float] = mapped_column(Float, default=0.0)
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid")  # unpaid, paid
    payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
