from datetime import date, datetime
from uuid import uuid4
from sqlalchemy import ForeignKey, String, Date, Numeric, Integer, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin, TimestampMixin


# --- LIBRARY MODELS ---
class Book(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "books"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    title: Mapped[str] = mapped_column(String(200))
    author: Mapped[str] = mapped_column(String(100))
    isbn: Mapped[str | None] = mapped_column(String(50), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    available_quantity: Mapped[int] = mapped_column(Integer, default=1)


class BookIssue(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "book_issues"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey("books.id"))
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"))
    issue_date: Mapped[date] = mapped_column(Date)
    return_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="issued")  # issued, returned


# --- HOSTEL MODELS ---
class Hostel(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "hostels"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(100))
    hostel_type: Mapped[str] = mapped_column(String(20))  # boys, girls, coed
    capacity: Mapped[int] = mapped_column(Integer)


class HostelRoom(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "hostel_rooms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    hostel_id: Mapped[str] = mapped_column(String(36), ForeignKey("hostels.id"))
    room_number: Mapped[str] = mapped_column(String(20))
    bed_count: Mapped[int] = mapped_column(Integer)
    available_beds: Mapped[int] = mapped_column(Integer)
    cost_per_month: Mapped[float] = mapped_column(Numeric(10, 2))


# --- TRANSPORT MODELS ---
class TransportRoute(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "transport_routes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(100))
    start_point: Mapped[str] = mapped_column(String(100))
    end_point: Mapped[str] = mapped_column(String(100))
    cost: Mapped[float] = mapped_column(Numeric(10, 2))


class Vehicle(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vehicle_number: Mapped[str] = mapped_column(String(50))
    driver_name: Mapped[str] = mapped_column(String(100))
    driver_phone: Mapped[str] = mapped_column(String(20))
    capacity: Mapped[int] = mapped_column(Integer)
    is_tracking: Mapped[bool] = mapped_column(Boolean, default=False)
    current_latitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    current_longitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    last_location_update: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
