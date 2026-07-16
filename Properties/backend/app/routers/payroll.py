from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.session import get_db
from app.models import Staff, User, SalaryStructure, MonthlyPayroll

router = APIRouter(prefix="/payroll", tags=["payroll"])


class SalaryStructureCreate(BaseModel):
    staff_id: UUID
    base_salary: float
    allowances: float = 0.0
    deductions: float = 0.0


class PayrollGenerateRequest(BaseModel):
    month: int
    year: int


@router.get("/structures")
async def list_salary_structures(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("fees:view")),  # Reusing Accountant/Admin permission
):
    query = (
        select(SalaryStructure, Staff, User)
        .join(Staff, Staff.id == SalaryStructure.staff_id)
        .join(User, User.id == Staff.user_id)
        .where(
            SalaryStructure.is_deleted.is_(False),
            Staff.is_deleted.is_(False),
        )
    )
    result = await db.execute(query)
    structures = []
    for struct, staff, user in result.all():
        structures.append(
            {
                "id": struct.id,
                "staff_id": staff.id,
                "employee_id": staff.employee_id,
                "staff_name": f"{user.first_name} {user.last_name}",
                "base_salary": struct.base_salary,
                "allowances": struct.allowances,
                "deductions": struct.deductions,
            }
        )
    return success_response(data=structures)


@router.post("/structures")
async def save_salary_structure(
    body: SalaryStructureCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("fees:collect")),
):
    # Verify staff exists
    staff_result = await db.execute(
        select(Staff).where(Staff.id == str(body.staff_id), Staff.is_deleted.is_(False))
    )
    staff = staff_result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    # Check if structure already exists
    struct_result = await db.execute(
        select(SalaryStructure).where(
            SalaryStructure.staff_id == str(body.staff_id),
            SalaryStructure.is_deleted.is_(False),
        )
    )
    struct = struct_result.scalar_one_or_none()

    if struct:
        struct.base_salary = body.base_salary
        struct.allowances = body.allowances
        struct.deductions = body.deductions
    else:
        struct = SalaryStructure(
            staff_id=str(body.staff_id),
            base_salary=body.base_salary,
            allowances=body.allowances,
            deductions=body.deductions,
        )
        db.add(struct)

    await db.commit()
    return success_response(
        data={
            "id": struct.id,
            "staff_id": struct.staff_id,
            "base_salary": struct.base_salary,
            "allowances": struct.allowances,
            "deductions": struct.deductions,
        },
        message="Salary structure saved successfully",
    )


@router.post("/generate")
async def generate_monthly_payroll(
    body: PayrollGenerateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("fees:collect")),
):
    if body.month < 1 or body.month > 12:
        raise HTTPException(status_code=400, detail="Invalid month")

    # Get all active staff who have a salary structure
    query = (
        select(Staff, SalaryStructure)
        .join(SalaryStructure, SalaryStructure.staff_id == Staff.id)
        .where(
            Staff.is_active.is_(True),
            Staff.is_deleted.is_(False),
            SalaryStructure.is_deleted.is_(False),
        )
    )
    result = await db.execute(query)
    records = result.all()

    generated_count = 0
    for staff, struct in records:
        # Check if payroll already exists for this staff, month, and year
        exists_query = select(MonthlyPayroll).where(
            MonthlyPayroll.staff_id == staff.id,
            MonthlyPayroll.month == body.month,
            MonthlyPayroll.year == body.year,
            MonthlyPayroll.is_deleted.is_(False),
        )
        existing = (await db.execute(exists_query)).scalar_one_or_none()
        if existing:
            continue

        net_salary = struct.base_salary + struct.allowances - struct.deductions
        payroll = MonthlyPayroll(
            staff_id=staff.id,
            month=body.month,
            year=body.year,
            net_salary=net_salary,
            payment_status="unpaid",
        )
        db.add(payroll)
        generated_count += 1

    await db.commit()
    return success_response(
        data={"generated_records": generated_count},
        message=f"Payroll generated successfully for {generated_count} staff members",
    )


@router.get("/")
async def list_payroll_records(
    month: int | None = None,
    year: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("fees:view")),
):
    query = (
        select(MonthlyPayroll, Staff, User)
        .join(Staff, Staff.id == MonthlyPayroll.staff_id)
        .join(User, User.id == Staff.user_id)
        .where(
            MonthlyPayroll.is_deleted.is_(False),
            Staff.is_deleted.is_(False),
        )
    )
    if month:
        query = query.where(MonthlyPayroll.month == month)
    if year:
        query = query.where(MonthlyPayroll.year == year)

    result = await db.execute(query)
    payrolls = []
    for payroll, staff, user in result.all():
        payrolls.append(
            {
                "id": payroll.id,
                "staff_id": staff.id,
                "employee_id": staff.employee_id,
                "staff_name": f"{user.first_name} {user.last_name}",
                "month": payroll.month,
                "year": payroll.year,
                "net_salary": payroll.net_salary,
                "payment_status": payroll.payment_status,
                "payment_date": payroll.payment_date.isoformat() if payroll.payment_date else None,
            }
        )
    return success_response(data=payrolls)


@router.post("/{payroll_id}/pay")
async def pay_salary(
    payroll_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("fees:collect")),
):
    result = await db.execute(
        select(MonthlyPayroll).where(
            MonthlyPayroll.id == str(payroll_id),
            MonthlyPayroll.is_deleted.is_(False),
        )
    )
    payroll = result.scalar_one_or_none()
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll record not found")

    if payroll.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Salary already paid")

    payroll.payment_status = "paid"
    payroll.payment_date = date.today()

    await db.commit()
    return success_response(message="Salary marked as paid successfully")
