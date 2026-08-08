from datetime import date, datetime, timezone
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response, get_current_user
from app.core.enums import UserRole, LeaveStatus
from app.core.security import hash_password
from app.core.session import get_db
from app.models import Staff, User, LeaveApplication
from app.utils.excel import parse_excel_or_csv, generate_excel_template

router = APIRouter(prefix="/hr", tags=["hr"])



class StaffCreate(BaseModel):
    email: EmailStr
    phone: str | None = None
    first_name: str
    last_name: str
    employee_id: str
    department: str
    role: UserRole
    password: str


class LeaveApply(BaseModel):
    leave_type: str
    from_date: date
    to_date: date
    reason: str


@router.get("/staff")
async def list_all_staff(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:view")),
):
    query = (
        select(Staff, User)
        .join(User, User.id == Staff.user_id)
        .where(
            User.is_deleted.is_(False),
            Staff.is_deleted.is_(False),
        )
    )
    result = await db.execute(query)
    staff_list = []
    for staff, user in result.all():
        staff_list.append(
            {
                "id": staff.id,
                "user_id": user.id,
                "employee_id": staff.employee_id,
                "department": staff.department,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "phone": user.phone,
                "role": user.role,
                "is_active": staff.is_active,
            }
        )
    return success_response(data=staff_list)


@router.post("/staff", status_code=status.HTTP_201_CREATED)
async def onboard_staff(
    body: StaffCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:edit")),
):
    if not (body.email.endswith("@gmail.com") or body.email.endswith("@school.edu")):
        raise HTTPException(
            status_code=400,
            detail="Staff onboarding is restricted to Gmail accounts (@gmail.com) only",
        )
    # Check if user already exists
    exist_check = await db.execute(
        select(User).where((User.email == body.email) & (User.is_deleted.is_(False)))
    )
    if exist_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Check employee_id
    emp_check = await db.execute(
        select(Staff).where((Staff.employee_id == body.employee_id) & (Staff.is_deleted.is_(False)))
    )
    if emp_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Employee ID already exists")

    if body.role in (UserRole.SUPER_ADMIN, UserRole.DEVELOPER):
        raise HTTPException(status_code=400, detail="Cannot onboard Super Admin or Developer through HR panel")

    user = User(
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        role=body.role,
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
        data={
            "id": staff.id,
            "user_id": user.id,
            "employee_id": staff.employee_id,
            "department": staff.department,
            "role": user.role,
        },
        message="Staff member onboarded successfully",
    )



@router.get("/staff/bulk-template")
async def get_staff_bulk_template():
    headers = ["Employee ID", "First Name", "Last Name", "Email", "Phone", "Department", "Role", "Password"]
    sample_rows = [
        {
            "Employee ID": "EMP2026002",
            "First Name": "Anita",
            "Last Name": "Roy",
            "Email": "anita.roy@school.edu",
            "Phone": "9876543212",
            "Department": "Administration",
            "Role": "accountant",
            "Password": "Staff@12345"
        }
    ]
    file_bytes = generate_excel_template(headers, sample_rows, sheet_name="Staff_Template")
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=staff_import_template.xlsx"}
    )


@router.post("/staff/bulk-import")
async def bulk_import_staff(
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
            department = row.get("Department", "").strip() or "General"
            role_str = row.get("Role", "").strip().lower() or "teacher"
            raw_pwd = row.get("Password", "").strip() or "Staff@12345"

            if not emp_id or not first_name or not last_name or not email:
                errors.append(f"Row {row_idx}: Missing required fields (Employee ID, First Name, Last Name, Email).")
                continue

            try:
                role_enum = UserRole(role_str)
            except Exception:
                role_enum = UserRole.TEACHER

            exist_email = await db.execute(
                select(User).where((User.email == email) & (User.is_deleted.is_(False)))
            )
            if exist_email.scalar_one_or_none():
                errors.append(f"Row {row_idx}: Email '{email}' already exists.")
                continue

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
                role=role_enum,
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
            errors.append(f"Row {row_idx}: Error onboarding staff ({e})")

    await db.commit()
    return success_response(
        data={"imported": imported_count, "errors": errors},
        message=f"Successfully imported {imported_count} staff members with {len(errors)} errors."
    )


@router.get("/leaves")
async def list_leaves(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:view")),
):
    query = (
        select(LeaveApplication, User)
        .join(User, User.id == LeaveApplication.applicant_id)
        .where(LeaveApplication.is_deleted.is_(False))
    )
    result = await db.execute(query)
    leaves = []
    for app, user in result.all():
        leaves.append(
            {
                "id": app.id,
                "applicant_id": app.applicant_id,
                "applicant_name": f"{user.first_name} {user.last_name}",
                "applicant_role": user.role,
                "leave_type": app.leave_type,
                "from_date": app.from_date.isoformat(),
                "to_date": app.to_date.isoformat(),
                "days": app.days,
                "reason": app.reason,
                "status": app.status,
                "applied_at": app.applied_at.isoformat(),
            }
        )
    return success_response(data=leaves)


@router.post("/leaves")
async def apply_leave(
    body: LeaveApply,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    days = (body.to_date - body.from_date).days + 1
    if days <= 0:
        raise HTTPException(status_code=400, detail="To date must be after or equal to from date")

    app = LeaveApplication(
        applicant_id=current_user.id,
        applicant_type=current_user.role.value,
        leave_type=body.leave_type,
        from_date=body.from_date,
        to_date=body.to_date,
        days=days,
        reason=body.reason,
        status=LeaveStatus.PENDING,
        applied_at=datetime.now(timezone.utc),
    )
    db.add(app)
    await db.commit()

    return success_response(
        data={
            "id": app.id,
            "from_date": app.from_date.isoformat(),
            "to_date": app.to_date.isoformat(),
            "days": app.days,
            "status": app.status,
        },
        message="Leave application submitted successfully",
    )


@router.post("/leaves/{leave_id}/approve")
async def approve_leave(
    leave_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:edit")),
):
    result = await db.execute(
        select(LeaveApplication).where(
            LeaveApplication.id == str(leave_id),
            LeaveApplication.is_deleted.is_(False),
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Leave application not found")

    app.status = LeaveStatus.APPROVED
    await db.commit()
    return success_response(message="Leave application approved")


@router.post("/leaves/{leave_id}/reject")
async def reject_leave(
    leave_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:edit")),
):
    result = await db.execute(
        select(LeaveApplication).where(
            LeaveApplication.id == str(leave_id),
            LeaveApplication.is_deleted.is_(False),
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Leave application not found")

    app.status = LeaveStatus.REJECTED
    await db.commit()
    return success_response(message="Leave application rejected")
