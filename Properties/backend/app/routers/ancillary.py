import logging
from datetime import date, datetime
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.session import get_db
from app.models import Book, BookIssue, Hostel, HostelRoom, TransportRoute, Vehicle, Student, User

logger = logging.getLogger("siddardha")

router = APIRouter(prefix="/ancillary", tags=["ancillary"])


# Pydantic Schemas
class BookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    author: str
    isbn: str | None
    quantity: int
    available_quantity: int


class BookCreate(BaseModel):
    title: str
    author: str
    isbn: str | None = None
    quantity: int = 1


class BookIssueCreate(BaseModel):
    book_id: UUID
    student_id: UUID
    issue_date: date = date.today()


class HostelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    hostel_type: str
    capacity: int


class HostelCreate(BaseModel):
    name: str
    hostel_type: str
    capacity: int


class HostelRoomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    hostel_id: UUID
    room_number: str
    bed_count: int
    available_beds: int
    cost_per_month: float


class HostelRoomCreate(BaseModel):
    hostel_id: UUID
    room_number: str
    bed_count: int
    cost_per_month: float


class TransportRouteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    start_point: str
    end_point: str
    cost: float


class TransportRouteCreate(BaseModel):
    name: str
    start_point: str
    end_point: str
    cost: float


class VehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    vehicle_number: str
    driver_name: str
    driver_phone: str
    capacity: int
    is_tracking: bool
    current_latitude: float | None
    current_longitude: float | None
    last_location_update: datetime | None


class VehicleGPSUpdate(BaseModel):
    latitude: float
    longitude: float
    is_tracking: bool


class VehicleCreate(BaseModel):
    vehicle_number: str
    driver_name: str
    driver_phone: str
    capacity: int


# --- LIBRARY ENDPOINTS ---
@router.get("/library/books")
async def list_books(
    _: User = Depends(require_permission("library:view")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Book).where(Book.is_deleted.is_(False))
    result = await db.execute(query)
    books = result.scalars().all()
    return success_response(data=[BookOut.model_validate(b).model_dump(mode="json") for b in books])


@router.post("/library/books")
async def create_book(
    body: BookCreate,
    _: User = Depends(require_permission("library:edit")),
    db: AsyncSession = Depends(get_db),
):
    book = Book(
        title=body.title,
        author=body.author,
        isbn=body.isbn,
        quantity=body.quantity,
        available_quantity=body.quantity,
    )
    db.add(book)
    await db.flush()
    await db.refresh(book)
    return success_response(data=BookOut.model_validate(book).model_dump(mode="json"), message="Book added to library catalog")


@router.get("/library/issues")
async def list_book_issues(
    _: User = Depends(require_permission("library:view")),
    db: AsyncSession = Depends(get_db),
):
    query = select(BookIssue).where(BookIssue.is_deleted.is_(False))
    result = await db.execute(query)
    issues = result.scalars().all()
    
    data = []
    for issue in issues:
        book_res = await db.execute(select(Book).where(Book.id == issue.book_id))
        book = book_res.scalar_one_or_none()
        student_res = await db.execute(select(Student).where(Student.id == issue.student_id))
        student = student_res.scalar_one_or_none()
        
        data.append({
            "id": issue.id,
            "book_title": book.title if book else "Unknown Book",
            "student_name": f"{student.first_name} {student.last_name}" if student else "Unknown Student",
            "admission_number": student.admission_number if student else "—",
            "issue_date": issue.issue_date.isoformat(),
            "return_date": issue.return_date.isoformat() if issue.return_date else None,
            "status": issue.status
        })
    return success_response(data=data)


@router.post("/library/issues")
async def issue_book(
    body: BookIssueCreate,
    _: User = Depends(require_permission("library:edit")),
    db: AsyncSession = Depends(get_db),
):
    # Verify book availability
    book_res = await db.execute(select(Book).where(Book.id == str(body.book_id), Book.is_deleted.is_(False)))
    book = book_res.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.available_quantity <= 0:
        raise HTTPException(status_code=400, detail="No copies of this book are currently available")
        
    issue = BookIssue(
        book_id=str(body.book_id),
        student_id=str(body.student_id),
        issue_date=body.issue_date,
        status="issued",
    )
    book.available_quantity -= 1
    db.add(issue)
    await db.flush()
    return success_response(message="Book issued successfully.")


@router.post("/library/issues/{issue_id}/return")
async def return_book(
    issue_id: UUID,
    _: User = Depends(require_permission("library:edit")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(BookIssue).where(BookIssue.id == str(issue_id), BookIssue.is_deleted.is_(False)))
    issue = res.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue record not found")
        
    if issue.status == "returned":
        return success_response(message="Book was already returned.")
        
    issue.status = "returned"
    issue.return_date = date.today()
    
    # Increment book copies available
    book_res = await db.execute(select(Book).where(Book.id == issue.book_id))
    book = book_res.scalar_one_or_none()
    if book:
        book.available_quantity = min(book.quantity, book.available_quantity + 1)
        
    await db.flush()
    return success_response(message="Book returned successfully.")


# --- HOSTEL ENDPOINTS ---
@router.get("/hostel/hostels")
async def list_hostels(
    _: User = Depends(require_permission("hostels:view")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Hostel).where(Hostel.is_deleted.is_(False))
    result = await db.execute(query)
    hostels = result.scalars().all()
    return success_response(data=[HostelOut.model_validate(h).model_dump(mode="json") for h in hostels])


@router.post("/hostel/hostels")
async def create_hostel(
    body: HostelCreate,
    _: User = Depends(require_permission("hostels:edit")),
    db: AsyncSession = Depends(get_db),
):
    hostel = Hostel(**body.model_dump())
    db.add(hostel)
    await db.flush()
    await db.refresh(hostel)
    return success_response(data=HostelOut.model_validate(hostel).model_dump(mode="json"), message="Hostel created")


@router.get("/hostel/rooms")
async def list_hostel_rooms(
    hostel_id: UUID | None = None,
    _: User = Depends(require_permission("hostels:view")),
    db: AsyncSession = Depends(get_db),
):
    query = select(HostelRoom).where(HostelRoom.is_deleted.is_(False))
    if hostel_id:
        query = query.where(HostelRoom.hostel_id == str(hostel_id))
    result = await db.execute(query)
    rooms = result.scalars().all()
    return success_response(data=[HostelRoomOut.model_validate(r).model_dump(mode="json") for r in rooms])


@router.post("/hostel/rooms")
async def create_hostel_room(
    body: HostelRoomCreate,
    _: User = Depends(require_permission("hostels:edit")),
    db: AsyncSession = Depends(get_db),
):
    room = HostelRoom(
        hostel_id=str(body.hostel_id),
        room_number=body.room_number,
        bed_count=body.bed_count,
        available_beds=body.bed_count,
        cost_per_month=body.cost_per_month,
    )
    db.add(room)
    await db.flush()
    await db.refresh(room)
    return success_response(data=HostelRoomOut.model_validate(room).model_dump(mode="json"), message="Hostel room added")


# --- TRANSPORT ENDPOINTS ---
@router.get("/transport/routes")
async def list_transport_routes(
    _: User = Depends(require_permission("transport:view")),
    db: AsyncSession = Depends(get_db),
):
    query = select(TransportRoute).where(TransportRoute.is_deleted.is_(False))
    result = await db.execute(query)
    routes = result.scalars().all()
    return success_response(data=[TransportRouteOut.model_validate(r).model_dump(mode="json") for r in routes])


@router.post("/transport/routes")
async def create_transport_route(
    body: TransportRouteCreate,
    _: User = Depends(require_permission("transport:edit")),
    db: AsyncSession = Depends(get_db),
):
    route = TransportRoute(**body.model_dump())
    db.add(route)
    await db.flush()
    await db.refresh(route)
    return success_response(data=TransportRouteOut.model_validate(route).model_dump(mode="json"), message="Transport route created")


@router.get("/transport/vehicles")
async def list_vehicles(
    _: User = Depends(require_permission("transport:view")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Vehicle).where(Vehicle.is_deleted.is_(False))
    result = await db.execute(query)
    vehicles = result.scalars().all()
    return success_response(data=[VehicleOut.model_validate(v).model_dump(mode="json") for v in vehicles])


@router.post("/transport/vehicles")
async def create_vehicle(
    body: VehicleCreate,
    _: User = Depends(require_permission("transport:edit")),
    db: AsyncSession = Depends(get_db),
):
    vehicle = Vehicle(**body.model_dump())
    db.add(vehicle)
    await db.flush()
    await db.refresh(vehicle)
    return success_response(data=VehicleOut.model_validate(vehicle).model_dump(mode="json"), message="Vehicle added to fleet")


@router.post("/transport/vehicles/{vehicle_id}/gps")
async def update_vehicle_gps(
    vehicle_id: UUID,
    body: VehicleGPSUpdate,
    _: User = Depends(require_permission("transport:edit")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Vehicle).where(Vehicle.id == str(vehicle_id), Vehicle.is_deleted.is_(False)))
    vehicle = res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    vehicle.is_tracking = body.is_tracking
    vehicle.current_latitude = body.latitude
    vehicle.current_longitude = body.longitude
    vehicle.last_location_update = datetime.utcnow()
    
    await db.flush()
    return success_response(data=VehicleOut.model_validate(vehicle).model_dump(mode="json"), message="GPS coordinates updated")


@router.get("/transport/vehicles/{vehicle_id}/gps")
async def get_vehicle_gps(
    vehicle_id: UUID,
    _: User = Depends(require_permission("transport:view")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Vehicle).where(Vehicle.id == str(vehicle_id), Vehicle.is_deleted.is_(False)))
    vehicle = res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    return success_response(
        data={
            "id": vehicle.id,
            "vehicle_number": vehicle.vehicle_number,
            "is_tracking": vehicle.is_tracking,
            "latitude": float(vehicle.current_latitude) if vehicle.current_latitude is not None else None,
            "longitude": float(vehicle.current_longitude) if vehicle.current_longitude is not None else None,
            "last_location_update": vehicle.last_location_update.isoformat() if vehicle.last_location_update else None
        }
    )
