import logging
from datetime import date
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, Query, HTTPException, File, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.enums import AttendanceStatus
from app.core.session import get_db
from app.models import Attendance, Student, Parent, User
from app.utils.sms import send_sms
from app.utils.excel import parse_excel_or_csv, generate_excel_template


logger = logging.getLogger("siddardha")

router = APIRouter(prefix="/attendance", tags=["attendance"])


# Pydantic Schemas
class AttendanceRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str | UUID
    student_id: str | UUID
    section_id: str | UUID | None = None
    academic_year_id: str | UUID | None = None
    date: date
    status: str | AttendanceStatus
    remarks: str | None = None
    marked_by: str | UUID | None = None


class AttendanceMark(BaseModel):
    student_id: UUID
    status: AttendanceStatus


class AttendanceMarkBulk(BaseModel):
    section_id: UUID
    academic_year_id: UUID
    date: date
    records: list[AttendanceMark]


# Endpoints
@router.get("/")
async def get_attendance(
    date_val: date = Query(..., alias="date"),
    section_id: UUID = Query(...),
    _: User = Depends(require_permission("attendance:view")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Attendance).where(
        Attendance.date == date_val,
        Attendance.section_id == str(section_id),
        Attendance.is_deleted.is_(False)
    )
    result = await db.execute(query)
    records = result.scalars().all()
    
    data = [AttendanceRecordOut.model_validate(r).model_dump(mode="json") for r in records]
    return success_response(data=data)


@router.post("/bulk")
async def mark_bulk_attendance(
    body: AttendanceMarkBulk,
    user: User = Depends(require_permission("attendance:edit")),
    db: AsyncSession = Depends(get_db),
):
    marked_records = []
    
    for record in body.records:
        # Check if record already exists for this student on this date
        exist_query = select(Attendance).where(
            Attendance.student_id == str(record.student_id),
            Attendance.date == body.date,
            Attendance.is_deleted.is_(False)
        )
        existing = (await db.execute(exist_query)).scalar_one_or_none()
        
        if existing:
            existing.status = record.status
            existing.marked_by = str(user.id)
            marked_records.append(existing)
        else:
            att = Attendance(
                student_id=str(record.student_id),
                section_id=str(body.section_id),
                academic_year_id=str(body.academic_year_id),
                date=body.date,
                status=record.status,
                marked_by=str(user.id),
            )
            db.add(att)
            marked_records.append(att)
            
        # If student is marked absent, trigger parent SMS notification
        if record.status == AttendanceStatus.ABSENT:
            # Query parent details
            parent_query = select(Parent).where(
                Parent.student_id == str(record.student_id),
                Parent.is_primary_contact.is_(True),
                Parent.is_deleted.is_(False)
            )
            parent = (await db.execute(parent_query)).scalar_one_or_none()
            
            if parent and parent.phone:
                student_query = select(Student).where(Student.id == str(record.student_id))
                student = (await db.execute(student_query)).scalar_one_or_none()
                
                if student:
                    message = f"Dear Parent, your ward {student.first_name} {student.last_name} was marked ABSENT today ({body.date.isoformat()}). Please contact the school office for any queries."
                    # Non-blocking trigger: we don't await the sms call to block the response
                    import asyncio
                    asyncio.create_task(send_sms(parent.phone, message))
                    logger.info(f"Triggered async parent SMS alert to {parent.phone}")

    await db.commit()
    return success_response(
        data=[AttendanceRecordOut.model_validate(r).model_dump(mode="json") for r in marked_records],
        message=f"Attendance updated for {len(marked_records)} students."
    )


@router.get("/bulk-template")
async def get_attendance_bulk_template():
    headers = ["Admission Number", "Date", "Status", "Remarks"]
    sample_rows = [
        {
            "Admission Number": "ADM2026001",
            "Date": date.today().isoformat(),
            "Status": "present",
            "Remarks": "On time"
        }
    ]
    file_bytes = generate_excel_template(headers, sample_rows, sheet_name="Attendance_Template")
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=attendance_import_template.xlsx"}
    )


@router.post("/bulk-import-excel")
async def bulk_import_attendance_excel(
    section_id: UUID = Query(...),
    academic_year_id: UUID = Query(...),
    file: UploadFile = File(...),
    user: User = Depends(require_permission("attendance:edit")),
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
            adm_num = row.get("Admission Number", "").strip()
            date_str = row.get("Date", "").strip()
            status_str = row.get("Status", "").strip().lower()

            if not adm_num or not date_str or not status_str:
                errors.append(f"Row {row_idx}: Missing Admission Number, Date, or Status.")
                continue

            # Find student by admission number
            stu_query = select(Student).where(Student.admission_number == adm_num, Student.is_deleted.is_(False))
            student = (await db.execute(stu_query)).scalar_one_or_none()
            if not student:
                errors.append(f"Row {row_idx}: Student with admission number '{adm_num}' not found.")
                continue

            try:
                att_date = date.fromisoformat(date_str[:10])
                att_status = AttendanceStatus(status_str)
            except Exception as pe:
                errors.append(f"Row {row_idx}: Invalid date or status value ({pe})")
                continue

            exist_query = select(Attendance).where(
                Attendance.student_id == str(student.id),
                Attendance.date == att_date,
                Attendance.is_deleted.is_(False)
            )
            existing = (await db.execute(exist_query)).scalar_one_or_none()

            if existing:
                existing.status = att_status
                existing.marked_by = str(user.id)
            else:
                att = Attendance(
                    student_id=str(student.id),
                    section_id=str(section_id),
                    academic_year_id=str(academic_year_id),
                    date=att_date,
                    status=att_status,
                    marked_by=str(user.id),
                )
                db.add(att)
            imported_count += 1
        except Exception as e:
            errors.append(f"Row {row_idx}: Error processing attendance row ({e})")

    await db.commit()
    return success_response(
        data={"imported": imported_count, "errors": errors},
        message=f"Successfully imported attendance for {imported_count} records with {len(errors)} errors."
    )

