import logging
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.session import get_db
from app.models import Student, User, FeePayment, FeeStructure, Attendance
from app.utils.gsheets import write_sheet

logger = logging.getLogger("siddardha")

router = APIRouter(prefix="/integrations", tags=["integrations"])


class SyncRequest(BaseModel):
    spreadsheet_id: str
    module: str  # students, fees, attendance


@router.post("/gsheets/sync")
async def sync_to_sheets(
    body: SyncRequest,
    _: User = Depends(require_permission("settings:edit")),
    db: AsyncSession = Depends(get_db)
):
    spreadsheet_id = body.spreadsheet_id
    module = body.module.lower()

    if module == "students":
        # Fetch students
        result = await db.execute(select(Student).where(Student.is_deleted.is_(False)))
        students = result.scalars().all()

        headers = [["Admission Number", "First Name", "Last Name", "Gender", "DOB", "Phone", "Email", "Status"]]
        rows = []
        for s in students:
            rows.append([
                s.admission_number,
                s.first_name,
                s.last_name,
                s.gender.value if s.gender else "",
                s.date_of_birth.isoformat() if s.date_of_birth else "",
                s.phone or "",
                s.email or "",
                "Active" if s.is_active else "Inactive"
            ])
        
        values = headers + rows
        success = await write_sheet(spreadsheet_id, "Students!A1:H", values)
        if not success:
            raise HTTPException(status_code=500, detail="Google Sheets update failed. Please check spreadsheet ID and permissions.")
        
        return success_response(message="Students successfully synchronized to Google Sheets!")

    elif module == "fees":
        # Fetch fee payments joined with student & structure names
        result = await db.execute(
            select(FeePayment, Student.first_name, Student.last_name, FeeStructure.name)
            .join(Student, Student.id == FeePayment.student_id)
            .join(FeeStructure, FeeStructure.id == FeePayment.fee_structure_id)
            .where(FeePayment.is_deleted.is_(False))
        )
        records = result.all()

        headers = [["Receipt Number", "Student Name", "Fee Category", "Amount Paid", "Payment Date"]]
        rows = []
        for row in records:
            payment, s_first, s_last, s_name = row
            rows.append([
                payment.receipt_number,
                f"{s_first} {s_last}",
                s_name,
                str(payment.amount_paid),
                payment.payment_date.isoformat() if payment.payment_date else ""
            ])
            
        values = headers + rows
        success = await write_sheet(spreadsheet_id, "Fees!A1:E", values)
        if not success:
            raise HTTPException(status_code=500, detail="Google Sheets update failed. Please check spreadsheet ID and permissions.")
        
        return success_response(message="Fee payments successfully synchronized to Google Sheets!")

    elif module == "attendance":
        # Fetch attendance summaries joined with student names
        result = await db.execute(
            select(Attendance, Student.first_name, Student.last_name)
            .join(Student, Student.id == Attendance.student_id)
            .where(Attendance.is_deleted.is_(False))
        )
        records = result.all()

        headers = [["Student Name", "Date", "Status"]]
        rows = []
        for row in records:
            att, s_first, s_last = row
            rows.append([
                f"{s_first} {s_last}",
                att.date.isoformat() if att.date else "",
                att.status.value if att.status else ""
            ])
            
        values = headers + rows
        success = await write_sheet(spreadsheet_id, "Attendance!A1:C", values)
        if not success:
            raise HTTPException(status_code=500, detail="Google Sheets update failed. Please check spreadsheet ID and permissions.")
        
        return success_response(message="Attendance summaries successfully synchronized to Google Sheets!")

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported synchronization module: {module}")
