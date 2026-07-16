import logging
from datetime import date
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, Query, File, UploadFile, Form, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.session import get_db
from app.models import Exam, ExamSchedule, ExamMark, Student, User, Assignment, AssignmentSubmission
from app.utils.storage import upload_file

logger = logging.getLogger("siddardha")

router = APIRouter(prefix="/exams", tags=["exams"])


# Pydantic Schemas
class ExamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    academic_year_id: UUID
    name: str
    exam_type: str
    is_published: bool


class ExamCreate(BaseModel):
    academic_year_id: UUID
    name: str
    exam_type: str


class ExamScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    exam_id: UUID
    subject_id: UUID
    section_id: UUID
    exam_date: date
    max_marks: float
    pass_marks: float


class ExamScheduleCreate(BaseModel):
    subject_id: UUID
    section_id: UUID
    exam_date: date
    max_marks: float = 100.0
    pass_marks: float = 33.0


class ExamMarkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    exam_schedule_id: UUID
    student_id: UUID
    marks_obtained: float
    remarks: str | None


class ExamMarkSave(BaseModel):
    student_id: UUID
    marks_obtained: float
    remarks: str | None = None


class ExamMarksBulk(BaseModel):
    records: list[ExamMarkSave]


class AssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    section_id: UUID
    subject_id: UUID
    title: str
    description: str | None
    due_date: date
    file_url: str | None


class SubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    assignment_id: UUID
    student_id: UUID
    submission_date: date
    file_url: str
    marks_obtained: float | None
    feedback: str | None


class GradeSubmissionRequest(BaseModel):
    marks_obtained: float
    feedback: str | None = None


# --- EXAM ROUTES ---
@router.get("/")
async def list_exams(
    academic_year_id: UUID | None = None,
    _: User = Depends(require_permission("exams:view")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Exam).where(Exam.is_deleted.is_(False))
    if academic_year_id:
        query = query.where(Exam.academic_year_id == str(academic_year_id))
    result = await db.execute(query)
    exams = result.scalars().all()
    return success_response(data=[ExamOut.model_validate(e).model_dump(mode="json") for e in exams])


@router.post("/")
async def create_exam(
    body: ExamCreate,
    _: User = Depends(require_permission("exams:edit")),
    db: AsyncSession = Depends(get_db),
):
    exam = Exam(**body.model_dump())
    db.add(exam)
    await db.flush()
    await db.refresh(exam)
    return success_response(data=ExamOut.model_validate(exam).model_dump(mode="json"), message="Exam created")


@router.get("/{exam_id}/schedules")
async def list_exam_schedules(
    exam_id: UUID,
    section_id: UUID | None = None,
    _: User = Depends(require_permission("exams:view")),
    db: AsyncSession = Depends(get_db),
):
    query = select(ExamSchedule).where(ExamSchedule.exam_id == str(exam_id), ExamSchedule.is_deleted.is_(False))
    if section_id:
        query = query.where(ExamSchedule.section_id == str(section_id))
    result = await db.execute(query)
    schedules = result.scalars().all()
    return success_response(data=[ExamScheduleOut.model_validate(s).model_dump(mode="json") for s in schedules])


@router.post("/{exam_id}/schedules")
async def create_exam_schedule(
    exam_id: UUID,
    body: ExamScheduleCreate,
    _: User = Depends(require_permission("exams:edit")),
    db: AsyncSession = Depends(get_db),
):
    schedule = ExamSchedule(exam_id=str(exam_id), **body.model_dump())
    db.add(schedule)
    await db.flush()
    await db.refresh(schedule)
    return success_response(data=ExamScheduleOut.model_validate(schedule).model_dump(mode="json"), message="Schedule added")


@router.get("/schedules/{schedule_id}/marks")
async def get_schedule_marks(
    schedule_id: UUID,
    _: User = Depends(require_permission("exams:view")),
    db: AsyncSession = Depends(get_db),
):
    # Fetch schedule to get the section_id
    sched_res = await db.execute(select(ExamSchedule).where(ExamSchedule.id == str(schedule_id)))
    sched = sched_res.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Fetch all students in the section
    students_res = await db.execute(
        select(Student).where(Student.section_id == sched.section_id, Student.is_deleted.is_(False))
    )
    students = students_res.scalars().all()

    # Fetch existing marks
    marks_res = await db.execute(
        select(ExamMark).where(ExamMark.exam_schedule_id == str(schedule_id), ExamMark.is_deleted.is_(False))
    )
    existing_marks = {m.student_id: m for m in marks_res.scalars().all()}

    data = []
    for s in students:
        mark = existing_marks.get(s.id)
        data.append({
            "student_id": s.id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "roll_number": s.roll_number,
            "marks_obtained": float(mark.marks_obtained) if mark else None,
            "remarks": mark.remarks if mark else None,
            "mark_id": mark.id if mark else None
        })

    return success_response(data=data)


@router.post("/schedules/{schedule_id}/marks")
async def save_schedule_marks(
    schedule_id: UUID,
    body: ExamMarksBulk,
    _: User = Depends(require_permission("exams:edit")),
    db: AsyncSession = Depends(get_db),
):
    for rec in body.records:
        # Check existing
        exist_query = select(ExamMark).where(
            ExamMark.exam_schedule_id == str(schedule_id),
            ExamMark.student_id == str(rec.student_id),
            ExamMark.is_deleted.is_(False)
        )
        existing = (await db.execute(exist_query)).scalar_one_or_none()

        if existing:
            existing.marks_obtained = rec.marks_obtained
            existing.remarks = rec.remarks
        else:
            mark = ExamMark(
                exam_schedule_id=str(schedule_id),
                student_id=str(rec.student_id),
                marks_obtained=rec.marks_obtained,
                remarks=rec.remarks,
            )
            db.add(mark)

    await db.flush()
    return success_response(message="Exam marks saved successfully.")


# --- LMS ROUTERS ---
@router.get("/lms/assignments")
async def list_assignments(
    section_id: UUID = Query(...),
    subject_id: UUID | None = None,
    _: User = Depends(require_permission("exams:view")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Assignment).where(Assignment.section_id == str(section_id), Assignment.is_deleted.is_(False))
    if subject_id:
        query = query.where(Assignment.subject_id == str(subject_id))
    result = await db.execute(query)
    assignments = result.scalars().all()
    return success_response(data=[AssignmentOut.model_validate(a).model_dump(mode="json") for a in assignments])


@router.post("/lms/assignments")
async def create_assignment(
    section_id: UUID = Form(...),
    subject_id: UUID = Form(...),
    title: str = Form(...),
    description: str | None = Form(None),
    due_date: date = Form(...),
    file: UploadFile | None = File(None),
    _: User = Depends(require_permission("exams:edit")),
    db: AsyncSession = Depends(get_db),
):
    file_url = None
    if file:
        content = await file.read()
        key = f"assignments/{uuid4()}_{file.filename}"
        file_url = upload_file(content, key, file.content_type)

    assignment = Assignment(
        section_id=str(section_id),
        subject_id=str(subject_id),
        title=title,
        description=description,
        due_date=due_date,
        file_url=file_url
    )
    db.add(assignment)
    await db.flush()
    await db.refresh(assignment)
    return success_response(data=AssignmentOut.model_validate(assignment).model_dump(mode="json"), message="Assignment created")


@router.get("/lms/assignments/{assignment_id}/submissions")
async def list_submissions(
    assignment_id: UUID,
    _: User = Depends(require_permission("exams:view")),
    db: AsyncSession = Depends(get_db),
):
    query = select(AssignmentSubmission).where(
        AssignmentSubmission.assignment_id == str(assignment_id),
        AssignmentSubmission.is_deleted.is_(False)
    )
    result = await db.execute(query)
    subs = result.scalars().all()
    return success_response(data=[SubmissionOut.model_validate(s).model_dump(mode="json") for s in subs])


@router.post("/lms/assignments/{assignment_id}/submissions")
async def submit_assignment(
    assignment_id: UUID,
    student_id: UUID = Form(...),
    file: UploadFile = File(...),
    _: User = Depends(require_permission("students:view")),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    key = f"submissions/{assignment_id}/{student_id}_{file.filename}"
    file_url = upload_file(content, key, file.content_type)

    sub = AssignmentSubmission(
        assignment_id=str(assignment_id),
        student_id=str(student_id),
        submission_date=date.today(),
        file_url=file_url
    )
    db.add(sub)
    await db.flush()
    await db.refresh(sub)
    return success_response(data=SubmissionOut.model_validate(sub).model_dump(mode="json"), message="Assignment submitted")


@router.post("/lms/submissions/{submission_id}/grade")
async def grade_submission(
    submission_id: UUID,
    body: GradeSubmissionRequest,
    _: User = Depends(require_permission("exams:edit")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(AssignmentSubmission).where(
            AssignmentSubmission.id == str(submission_id),
            AssignmentSubmission.is_deleted.is_(False)
        )
    )
    sub = res.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    sub.marks_obtained = body.marks_obtained
    sub.feedback = body.feedback
    await db.flush()
    return success_response(data=SubmissionOut.model_validate(sub).model_dump(mode="json"), message="Submission graded successfully!")
