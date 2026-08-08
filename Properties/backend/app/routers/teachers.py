from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.enums import UserRole
from app.core.security import hash_password
from app.core.session import get_db
from app.models import Staff, User
from app.utils.excel import parse_excel_or_csv, generate_excel_template

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


@router.get("/bulk-template")
async def get_teacher_bulk_template():
    headers = ["Employee ID", "First Name", "Last Name", "Email", "Phone", "Department", "Password"]
    sample_rows = [
        {
            "Employee ID": "EMP2026001",
            "First Name": "Suresh",
            "Last Name": "Reddy",
            "Email": "suresh.reddy@school.edu",
            "Phone": "9876543211",
            "Department": "Mathematics",
            "Password": "Teacher@12345"
        }
    ]
    file_bytes = generate_excel_template(headers, sample_rows, sheet_name="Teachers_Template")
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=teachers_import_template.xlsx"}
    )


@router.post("/bulk-import")
async def bulk_import_teachers(
    file: UploadFile = File(...),
    _: User = Depends(require_permission("students:edit")),
    db: AsyncSession = Depends(get_db),
):
    filename = file.filename or ""
    if not filename.lower().endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Only Excel (.xlsx, .xls) and CSV (.csv) files are supported.")

    content = await file.read()
    rows = parse_excel_or_csv(content, filename)

    imported_count = 0
    errors = []

    for row_idx, row in enumerate(rows, start=1):
        try:
            emp_id = row.get("Employee ID", "").strip()
            first_name = row.get("First Name", "").strip()
            last_name = row.get("Last Name", "").strip()
            email = row.get("Email", "").strip()
            phone = row.get("Phone", "").strip() or None
            department = row.get("Department", "").strip() or "Academic"
            raw_pwd = row.get("Password", "").strip() or "Teacher@12345"

            if not emp_id or not first_name or not last_name or not email:
                errors.append(f"Row {row_idx}: Missing required fields (Employee ID, First Name, Last Name, Email).")
                continue

            # Check email existing
            exist_email = await db.execute(
                select(User).where((User.email == email) & (User.is_deleted.is_(False)))
            )
            if exist_email.scalar_one_or_none():
                errors.append(f"Row {row_idx}: Email '{email}' already registered.")
                continue

            # Check emp_id existing
            exist_emp = await db.execute(
                select(Staff).where((Staff.employee_id == emp_id) & (Staff.is_deleted.is_(False)))
            )
            if exist_emp.scalar_one_or_none():
                errors.append(f"Row {row_idx}: Employee ID '{emp_id}' already exists.")
                continue

            user = User(
                email=email,
                phone=phone,
                password_hash=hash_password(raw_pwd),
                first_name=first_name,
                last_name=last_name,
                role=UserRole.TEACHER,
                is_active=True,
                is_email_verified=True,
            )
            db.add(user)
            await db.flush()

            staff = Staff(
                user_id=user.id,
                employee_id=emp_id,
                department=department,
                is_active=True,
            )
            db.add(staff)
            imported_count += 1
        except Exception as e:
            errors.append(f"Row {row_idx}: Error creating teacher record ({e})")

    await db.commit()
    return success_response(
        data={"imported": imported_count, "errors": errors},
        message=f"Successfully imported {imported_count} teachers with {len(errors)} errors."
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
