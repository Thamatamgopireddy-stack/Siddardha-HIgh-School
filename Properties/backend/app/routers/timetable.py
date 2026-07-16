from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.session import get_db
from app.models import TimetableEntry, User, Subject
from app.models.academic import SchoolClass, Section

router = APIRouter(prefix="/timetable", tags=["timetable"])


@router.get("/subjects")
async def get_subjects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject).where(Subject.is_deleted.is_(False)))
    subjects = result.scalars().all()
    if not subjects:
        # Fetch current academic year
        from app.models import AcademicYear
        yr_res = await db.execute(select(AcademicYear).where(AcademicYear.is_current.is_(True)))
        yr = yr_res.scalar_one_or_none()
        yr_id = yr.id if yr else str(uuid4())
        
        subjects = [
            Subject(name="Mathematics", code="MATH10", subject_type="theory", academic_year_id=yr_id),
            Subject(name="Science", code="SCI10", subject_type="theory", academic_year_id=yr_id),
            Subject(name="English", code="ENG10", subject_type="theory", academic_year_id=yr_id),
            Subject(name="Social Studies", code="SOC10", subject_type="theory", academic_year_id=yr_id),
            Subject(name="Computer Science", code="CS10", subject_type="practical", academic_year_id=yr_id),
        ]
        for s in subjects:
            db.add(s)
        await db.commit()
        
        # Re-fetch to load IDs
        result = await db.execute(select(Subject).where(Subject.is_deleted.is_(False)))
        subjects = result.scalars().all()
        
    return success_response(data=[{"id": s.id, "name": s.name, "code": s.code} for s in subjects])


class TimetableEntryCreate(BaseModel):
    class_id: UUID
    section_id: UUID
    subject_id: UUID
    teacher_id: UUID
    day_of_week: str
    start_time: str
    end_time: str
    room_number: str | None = None


class TimetableEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    class_id: str
    section_id: str
    subject_id: str
    teacher_id: str
    day_of_week: str
    start_time: str
    end_time: str
    room_number: str | None
    subject_name: str | None = None
    teacher_name: str | None = None


@router.get("/class/{class_id}/section/{section_id}")
async def get_class_timetable(
    class_id: UUID,
    section_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:view")),
):
    query = (
        select(TimetableEntry, Subject, User)
        .join(Subject, Subject.id == TimetableEntry.subject_id)
        .join(User, User.id == TimetableEntry.teacher_id)
        .where(
            TimetableEntry.class_id == str(class_id),
            TimetableEntry.section_id == str(section_id),
            TimetableEntry.is_deleted.is_(False),
        )
    )
    result = await db.execute(query)
    entries = []
    for entry, subject, user in result.all():
        entries.append(
            TimetableEntryOut(
                id=entry.id,
                class_id=entry.class_id,
                section_id=entry.section_id,
                subject_id=entry.subject_id,
                teacher_id=entry.teacher_id,
                day_of_week=entry.day_of_week,
                start_time=entry.start_time,
                end_time=entry.end_time,
                room_number=entry.room_number,
                subject_name=subject.name,
                teacher_name=f"{user.first_name} {user.last_name}",
            )
        )
    return success_response(data=entries)


@router.get("/teacher/{teacher_id}")
async def get_teacher_timetable(
    teacher_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:view")),
):
    query = (
        select(TimetableEntry, Subject, SchoolClass, Section)
        .join(Subject, Subject.id == TimetableEntry.subject_id)
        .join(SchoolClass, SchoolClass.id == TimetableEntry.class_id)
        .join(Section, Section.id == TimetableEntry.section_id)
        .where(
            TimetableEntry.teacher_id == str(teacher_id),
            TimetableEntry.is_deleted.is_(False),
        )
    )
    result = await db.execute(query)
    entries = []
    for entry, subject, cls, sec in result.all():
        entries.append(
            {
                "id": entry.id,
                "class_id": entry.class_id,
                "class_name": cls.name,
                "section_id": entry.section_id,
                "section_name": sec.name,
                "subject_id": entry.subject_id,
                "subject_name": subject.name,
                "day_of_week": entry.day_of_week,
                "start_time": entry.start_time,
                "end_time": entry.end_time,
                "room_number": entry.room_number,
            }
        )
    return success_response(data=entries)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_timetable_entry(
    body: TimetableEntryCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:edit")),
):
    entry = TimetableEntry(
        class_id=str(body.class_id),
        section_id=str(body.section_id),
        subject_id=str(body.subject_id),
        teacher_id=str(body.teacher_id),
        day_of_week=body.day_of_week,
        start_time=body.start_time,
        end_time=body.end_time,
        room_number=body.room_number,
    )
    db.add(entry)
    await db.commit()
    return success_response(
        data={
            "id": entry.id,
            "class_id": entry.class_id,
            "section_id": entry.section_id,
            "subject_id": entry.subject_id,
            "teacher_id": entry.teacher_id,
            "day_of_week": entry.day_of_week,
            "start_time": entry.start_time,
            "end_time": entry.end_time,
            "room_number": entry.room_number,
        },
        message="Timetable entry created successfully",
    )


@router.put("/{entry_id}")
async def update_timetable_entry(
    entry_id: UUID,
    body: TimetableEntryCreate,  # Reuse create schema
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:edit")),
):
    result = await db.execute(
        select(TimetableEntry).where(
            TimetableEntry.id == str(entry_id),
            TimetableEntry.is_deleted.is_(False),
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Timetable entry not found")

    entry.class_id = str(body.class_id)
    entry.section_id = str(body.section_id)
    entry.subject_id = str(body.subject_id)
    entry.teacher_id = str(body.teacher_id)
    entry.day_of_week = body.day_of_week
    entry.start_time = body.start_time
    entry.end_time = body.end_time
    entry.room_number = body.room_number

    await db.commit()
    return success_response(message="Timetable entry updated successfully")


@router.delete("/{entry_id}")
async def delete_timetable_entry(
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:edit")),
):
    result = await db.execute(
        select(TimetableEntry).where(
            TimetableEntry.id == str(entry_id),
            TimetableEntry.is_deleted.is_(False),
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Timetable entry not found")

    entry.is_deleted = True
    await db.commit()
    return success_response(message="Timetable entry deleted successfully")
