from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.enums import UserRole
from app.core.security import hash_password
from app.core.session import get_db
from app.models import Staff, User

router = APIRouter(prefix="/teachers", tags=["teachers"])


class TeacherCreate(BaseModel):
    email: EmailStr
    phone: str | None = None
    first_name: str
    last_name: str
    employee_id: str
    department: str | None = "Academic"
    password: str


class TeacherUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    department: str | None = None
    is_active: bool | None = None


class TeacherOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    employee_id: str
    department: str | None
    first_name: str
    last_name: str
    email: str
    phone: str | None
    is_active: bool


@router.get("/")
async def list_teachers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:view")),  # Reusing generic view permission
):
    query = (
        select(Staff, User)
        .join(User, User.id == Staff.user_id)
        .where(
            User.role == UserRole.TEACHER,
            User.is_deleted.is_(False),
            Staff.is_deleted.is_(False),
        )
    )
    result = await db.execute(query)
    teachers = []
    for staff, user in result.all():
        teachers.append(
            TeacherOut(
                id=staff.id,
                user_id=user.id,
                employee_id=staff.employee_id,
                department=staff.department,
                first_name=user.first_name,
                last_name=user.last_name,
                email=user.email,
                phone=user.phone,
                is_active=staff.is_active,
            )
        )
    return success_response(data=teachers)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_teacher(
    body: TeacherCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:edit")),
):
    # Check if user already exists by email/phone
    exist_check = await db.execute(
        select(User).where((User.email == body.email) & (User.is_deleted.is_(False)))
    )
    if exist_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Check if employee_id already exists
    emp_check = await db.execute(
        select(Staff).where((Staff.employee_id == body.employee_id) & (Staff.is_deleted.is_(False)))
    )
    if emp_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Employee ID already exists")

    user = User(
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        role=UserRole.TEACHER,
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    await db.flush()

    staff = Staff(
        user_id=user.id,
        employee_id=body.employee_id,
        department=body.department,
        is_active=True,
    )
    db.add(staff)
    await db.commit()

    return success_response(
        data=TeacherOut(
            id=staff.id,
            user_id=user.id,
            employee_id=staff.employee_id,
            department=staff.department,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            phone=user.phone,
            is_active=staff.is_active,
        ),
        message="Teacher created successfully",
    )


@router.put("/{teacher_id}")
async def update_teacher(
    teacher_id: UUID,
    body: TeacherUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:edit")),
):
    staff_result = await db.execute(
        select(Staff).where(Staff.id == str(teacher_id), Staff.is_deleted.is_(False))
    )
    staff = staff_result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Teacher not found")

    user_result = await db.execute(select(User).where(User.id == staff.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Teacher user record not found")

    if body.first_name is not None:
        user.first_name = body.first_name
    if body.last_name is not None:
        user.last_name = body.last_name
    if body.phone is not None:
        user.phone = body.phone
    if body.department is not None:
        staff.department = body.department
    if body.is_active is not None:
        staff.is_active = body.is_active
        user.is_active = body.is_active

    await db.commit()

    return success_response(
        data=TeacherOut(
            id=staff.id,
            user_id=user.id,
            employee_id=staff.employee_id,
            department=staff.department,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            phone=user.phone,
            is_active=staff.is_active,
        ),
        message="Teacher updated successfully",
    )


@router.delete("/{teacher_id}")
async def delete_teacher(
    teacher_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:edit")),
):
    staff_result = await db.execute(
        select(Staff).where(Staff.id == str(teacher_id), Staff.is_deleted.is_(False))
    )
    staff = staff_result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Teacher not found")

    user_result = await db.execute(select(User).where(User.id == staff.user_id))
    user = user_result.scalar_one_or_none()

    staff.is_deleted = True
    if user:
        user.is_deleted = True

    await db.commit()
    return success_response(message="Teacher deleted successfully")
