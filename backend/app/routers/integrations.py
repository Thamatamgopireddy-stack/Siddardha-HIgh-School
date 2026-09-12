import logging
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.session import get_db
from app.models import Student, User, FeePayment, FeeStructure, Attendance
from app.utils.gsheets import (
    write_sheet,
    get_service_account_status,
    test_spreadsheet_connection,
    extract_spreadsheet_id,
)

logger = logging.getLogger("educore")

router = APIRouter(prefix="/integrations", tags=["integrations"])


class SyncRequest(BaseModel):
    spreadsheet_id: str
    module: str  # students, fees, attendance


class TestConnectionRequest(BaseModel):
    spreadsheet_id: str


@router.get("/gsheets/status")
async def get_gsheets_status(
    _: User = Depends(require_permission("settings:read")),
):
    """
    Returns the current configuration status of Google Sheets integration,
    including service account client email.
    """
    status = get_service_account_status()
    return success_response(data=status, message="Google Sheets integration status retrieved.")


@router.post("/gsheets/test")
async def test_sheets_connection(
    body: TestConnectionRequest,
    _: User = Depends(require_permission("settings:read")),
):
    """
    Tests read/access permissions for a given spreadsheet ID/URL.
    """
    clean_id = extract_spreadsheet_id(body.spreadsheet_id)
    if not clean_id:
        raise HTTPException(status_code=400, detail="Please provide a valid Google Spreadsheet ID or URL.")

    ok, message, metadata = await test_spreadsheet_connection(clean_id)
    if not ok:
        raise HTTPException(status_code=400, detail=message)

    return success_response(data=metadata, message=message)


@router.post("/gsheets/sync")
async def sync_to_sheets(
    body: SyncRequest,
    _: User = Depends(require_permission("settings:edit")),
    db: AsyncSession = Depends(get_db)
):
    spreadsheet_id = extract_spreadsheet_id(body.spreadsheet_id)
    if not spreadsheet_id:
        raise HTTPException(status_code=400, detail="Please provide a valid Google Spreadsheet ID or URL.")

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
        success, error_msg = await write_sheet(spreadsheet_id, "Students!A1:H", values)
        if not success:
            raise HTTPException(status_code=400, detail=error_msg or "Failed to write students to Google Sheets.")
        
        return success_response(
            data={"synced_count": len(rows), "tab": "Students"},
            message=f"Successfully synchronized {len(rows)} students to Google Sheets tab 'Students'!"
        )

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
        success, error_msg = await write_sheet(spreadsheet_id, "Fees!A1:E", values)
        if not success:
            raise HTTPException(status_code=400, detail=error_msg or "Failed to write fees to Google Sheets.")
        
        return success_response(
            data={"synced_count": len(rows), "tab": "Fees"},
            message=f"Successfully synchronized {len(rows)} fee payments to Google Sheets tab 'Fees'!"
        )

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
        success, error_msg = await write_sheet(spreadsheet_id, "Attendance!A1:C", values)
        if not success:
            raise HTTPException(status_code=400, detail=error_msg or "Failed to write attendance to Google Sheets.")
        
        return success_response(
            data={"synced_count": len(rows), "tab": "Attendance"},
            message=f"Successfully synchronized {len(rows)} attendance records to Google Sheets tab 'Attendance'!"
        )

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported synchronization module: {module}")
