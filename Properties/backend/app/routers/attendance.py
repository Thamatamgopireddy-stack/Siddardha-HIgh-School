import logging
from datetime import date
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.enums import AttendanceStatus
from app.core.session import get_db
from app.models import Attendance, Student, Parent, User
from app.utils.sms import send_sms

logger = logging.getLogger("siddardha")

router = APIRouter(prefix="/attendance", tags=["attendance"])


# Pydantic Schemas
class AttendanceRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    student_id: UUID
    section_id: UUID
    academic_year_id: UUID
    date: date
    status: AttendanceStatus
    marked_by: UUID


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

    await db.flush()
    return success_response(message=f"Attendance marked successfully for {len(body.records)} students.")
