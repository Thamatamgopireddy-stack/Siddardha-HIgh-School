import logging
from datetime import date
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, Query, File, UploadFile, Form, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.session import get_db
from app.models import Exam, ExamSchedule, ExamMark, Student, User, Subject, Section, SchoolClass, AcademicYear, Assignment, AssignmentSubmission
from app.utils.storage import upload_file
from app.utils.pdf import generate_pdf

logger = logging.getLogger("educore")

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
    exam_type: str = "Mid-Term"


class ExamPublishToggle(BaseModel):
    is_published: bool


class ExamScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    exam_id: UUID
    subject_id: UUID
    subject_name: str | None = None
    subject_code: str | None = None
    section_id: UUID
    class_name: str | None = None
    section_name: str | None = None
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


# CBSE Grading Helper
def calculate_cbse_grade(percentage: float) -> str:
    if percentage >= 91.0:
        return "A1"
    elif percentage >= 81.0:
        return "A2"
    elif percentage >= 71.0:
        return "B1"
    elif percentage >= 61.0:
        return "B2"
    elif percentage >= 51.0:
        return "C1"
    elif percentage >= 41.0:
        return "C2"
    elif percentage >= 33.0:
        return "D"
    else:
        return "E"


async def _get_current_student(user: User, db: AsyncSession) -> Student | None:
    if user.role == "student":
        res = await db.execute(select(Student).where(Student.user_id == user.id, Student.is_deleted.is_(False)))
        return res.scalar_one_or_none()
    elif user.role == "parent":
        from app.models.parent import Parent
        parent_res = await db.execute(select(Parent).where(Parent.phone == user.phone, Parent.is_deleted.is_(False)))
        parent = parent_res.scalar_one_or_none()
        if parent and parent.student_id:
            st_res = await db.execute(select(Student).where(Student.id == parent.student_id, Student.is_deleted.is_(False)))
            return st_res.scalar_one_or_none()
    return None


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
    result = await db.execute(query.order_by(Exam.created_at.desc()))
    exams = result.scalars().all()
    return success_response(data=[ExamOut.model_validate(e).model_dump(mode="json") for e in exams])


@router.post("/")
async def create_exam(
    body: ExamCreate,
    _: User = Depends(require_permission("exams:manage")),
    db: AsyncSession = Depends(get_db),
):
    exam = Exam(
        academic_year_id=str(body.academic_year_id),
        name=body.name,
        exam_type=body.exam_type,
        is_published=False,
    )
    db.add(exam)
    await db.flush()
    await db.refresh(exam)
    return success_response(data=ExamOut.model_validate(exam).model_dump(mode="json"), message="Exam created successfully")


@router.put("/{exam_id}/publish")
async def publish_exam(
    exam_id: UUID,
    body: ExamPublishToggle,
    _: User = Depends(require_permission("exams:manage")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Exam).where(Exam.id == str(exam_id), Exam.is_deleted.is_(False)))
    exam = res.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    exam.is_published = body.is_published
    await db.flush()
    return success_response(
        data=ExamOut.model_validate(exam).model_dump(mode="json"),
        message=f"Exam status updated to {'published' if body.is_published else 'draft'}."
    )


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

    data = []
    for s in schedules:
        subj_res = await db.execute(select(Subject).where(Subject.id == s.subject_id))
        subj = subj_res.scalar_one_or_none()

        sec_res = await db.execute(select(Section).where(Section.id == s.section_id))
        sec = sec_res.scalar_one_or_none()
        class_name = "—"
        if sec:
            cls_res = await db.execute(select(SchoolClass).where(SchoolClass.id == sec.class_id))
            cls_val = cls_res.scalar_one_or_none()
            if cls_val:
                class_name = cls_val.name

        data.append({
            "id": s.id,
            "exam_id": s.exam_id,
            "subject_id": s.subject_id,
            "subject_name": subj.name if subj else "Subject",
            "subject_code": subj.code if subj else "—",
            "section_id": s.section_id,
            "class_name": class_name,
            "section_name": sec.name if sec else "—",
            "exam_date": s.exam_date.isoformat(),
            "max_marks": float(s.max_marks),
            "pass_marks": float(s.pass_marks),
        })

    return success_response(data=data)


@router.post("/{exam_id}/schedules")
async def create_exam_schedule(
    exam_id: UUID,
    body: ExamScheduleCreate,
    _: User = Depends(require_permission("exams:manage")),
    db: AsyncSession = Depends(get_db),
):
    schedule = ExamSchedule(
        exam_id=str(exam_id),
        subject_id=str(body.subject_id),
        section_id=str(body.section_id),
        exam_date=body.exam_date,
        max_marks=body.max_marks,
        pass_marks=body.pass_marks,
    )
    db.add(schedule)
    await db.flush()
    await db.refresh(schedule)
    return success_response(data=ExamScheduleOut.model_validate(schedule).model_dump(mode="json"), message="Exam subject schedule created")


@router.get("/schedules/{schedule_id}/marks")
async def get_schedule_marks(
    schedule_id: UUID,
    _: User = Depends(require_permission("exams:view")),
    db: AsyncSession = Depends(get_db),
):
    sched_res = await db.execute(select(ExamSchedule).where(ExamSchedule.id == str(schedule_id)))
    sched = sched_res.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")

    students_res = await db.execute(
        select(Student).where(Student.section_id == sched.section_id, Student.is_deleted.is_(False))
    )
    students = students_res.scalars().all()

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
            "admission_number": s.admission_number,
            "roll_number": s.roll_number,
            "marks_obtained": float(mark.marks_obtained) if mark else None,
            "remarks": mark.remarks if mark else None,
            "mark_id": mark.id if mark else None
        })

    return success_response(data={
        "schedule_id": sched.id,
        "max_marks": float(sched.max_marks),
        "pass_marks": float(sched.pass_marks),
        "students": data
    })


@router.post("/schedules/{schedule_id}/marks")
async def save_schedule_marks(
    schedule_id: UUID,
    body: ExamMarksBulk,
    _: User = Depends(require_permission("exams:manage")),
    db: AsyncSession = Depends(get_db),
):
    sched_res = await db.execute(select(ExamSchedule).where(ExamSchedule.id == str(schedule_id)))
    sched = sched_res.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")

    max_m = float(sched.max_marks)

    # Validate all marks first
    for rec in body.records:
        if rec.marks_obtained < 0 or rec.marks_obtained > max_m:
            raise HTTPException(
                status_code=400,
                detail=f"Marks obtained ({rec.marks_obtained}) cannot exceed maximum allowed marks ({max_m}) or be negative."
            )

    for rec in body.records:
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


@router.get("/my-results")
async def get_my_exam_results(
    current_user: User = Depends(require_permission("exams:view")),
    db: AsyncSession = Depends(get_db),
):
    st = await _get_current_student(current_user, db)
    if not st:
        return success_response(data=[])

    # Fetch published exams
    ex_res = await db.execute(
        select(Exam).where(Exam.academic_year_id == st.academic_year_id, Exam.is_published == True, Exam.is_deleted.is_(False))
    )
    exams = ex_res.scalars().all()

    results_list = []
    for exam in exams:
        # Fetch schedules for student's section
        sch_res = await db.execute(
            select(ExamSchedule).where(
                ExamSchedule.exam_id == exam.id,
                ExamSchedule.section_id == st.section_id,
                ExamSchedule.is_deleted.is_(False)
            )
        )
        schedules = sch_res.scalars().all()

        subject_marks = []
        total_max = 0.0
        total_obtained = 0.0
        is_passed = True

        for sched in schedules:
            subj_res = await db.execute(select(Subject).where(Subject.id == sched.subject_id))
            subj = subj_res.scalar_one_or_none()

            mark_res = await db.execute(
                select(ExamMark).where(
                    ExamMark.exam_schedule_id == sched.id,
                    ExamMark.student_id == st.id,
                    ExamMark.is_deleted.is_(False)
                )
            )
            mark = mark_res.scalar_one_or_none()

            obtained = float(mark.marks_obtained) if mark else 0.0
            max_m = float(sched.max_marks)
            pass_m = float(sched.pass_marks)

            total_max += max_m
            total_obtained += obtained
            if obtained < pass_m:
                is_passed = False

            subject_marks.append({
                "subject_name": subj.name if subj else "Subject",
                "subject_code": subj.code if subj else "—",
                "max_marks": max_m,
                "pass_marks": pass_m,
                "marks_obtained": obtained,
            })

        percentage = round((total_obtained / total_max * 100.0), 2) if total_max > 0 else 0.0
        grade = calculate_cbse_grade(percentage)

        results_list.append({
            "exam_id": exam.id,
            "exam_name": exam.name,
            "exam_type": exam.exam_type,
            "total_obtained": total_obtained,
            "total_max": total_max,
            "percentage": percentage,
            "grade": grade,
            "is_passed": is_passed,
            "subject_marks": subject_marks,
        })

    return success_response(data=results_list)


@router.get("/{exam_id}/results/{student_id}")
async def get_student_exam_result(
    exam_id: UUID,
    student_id: UUID,
    current_user: User = Depends(require_permission("exams:view")),
    db: AsyncSession = Depends(get_db),
):
    # RBAC check: student/parent can only view own
    if current_user.role in ("student", "parent"):
        st_own = await _get_current_student(current_user, db)
        if not st_own or st_own.id != str(student_id):
            raise HTTPException(status_code=403, detail="Access denied")

    ex_res = await db.execute(select(Exam).where(Exam.id == str(exam_id), Exam.is_deleted.is_(False)))
    exam = ex_res.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    st_res = await db.execute(select(Student).where(Student.id == str(student_id), Student.is_deleted.is_(False)))
    student = st_res.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    sch_res = await db.execute(
        select(ExamSchedule).where(
            ExamSchedule.exam_id == exam.id,
            ExamSchedule.section_id == student.section_id,
            ExamSchedule.is_deleted.is_(False)
        )
    )
    schedules = sch_res.scalars().all()

    subject_marks = []
    total_max = 0.0
    total_obtained = 0.0
    is_passed = True
    remarks = None

    for sched in schedules:
        subj_res = await db.execute(select(Subject).where(Subject.id == sched.subject_id))
        subj = subj_res.scalar_one_or_none()

        mark_res = await db.execute(
            select(ExamMark).where(
                ExamMark.exam_schedule_id == sched.id,
                ExamMark.student_id == student.id,
                ExamMark.is_deleted.is_(False)
            )
        )
        mark = mark_res.scalar_one_or_none()

        obtained = float(mark.marks_obtained) if mark else 0.0
        max_m = float(sched.max_marks)
        pass_m = float(sched.pass_marks)

        total_max += max_m
        total_obtained += obtained
        if mark and mark.remarks:
            remarks = mark.remarks
        if obtained < pass_m:
            is_passed = False

        subject_marks.append({
            "subject_name": subj.name if subj else "Subject",
            "subject_code": subj.code if subj else "—",
            "max_marks": max_m,
            "pass_marks": pass_m,
            "marks_obtained": obtained,
        })

    percentage = round((total_obtained / total_max * 100.0), 2) if total_max > 0 else 0.0
    grade = calculate_cbse_grade(percentage)

    return success_response(data={
        "exam_id": exam.id,
        "exam_name": exam.name,
        "student_id": student.id,
        "student_name": f"{student.first_name} {student.last_name}",
        "admission_number": student.admission_number,
        "total_obtained": total_obtained,
        "total_max": total_max,
        "percentage": percentage,
        "grade": grade,
        "is_passed": is_passed,
        "remarks": remarks,
        "subject_marks": subject_marks,
    })


@router.get("/{exam_id}/report-card/{student_id}")
async def download_student_report_card(
    exam_id: UUID,
    student_id: UUID,
    current_user: User = Depends(require_permission("exams:view")),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role in ("student", "parent"):
        st_own = await _get_current_student(current_user, db)
        if not st_own or st_own.id != str(student_id):
            raise HTTPException(status_code=403, detail="Access denied")

    ex_res = await db.execute(select(Exam).where(Exam.id == str(exam_id), Exam.is_deleted.is_(False)))
    exam = ex_res.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    st_res = await db.execute(select(Student).where(Student.id == str(student_id), Student.is_deleted.is_(False)))
    student = st_res.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Fetch academic year name, class name, section name
    ay_res = await db.execute(select(AcademicYear).where(AcademicYear.id == student.academic_year_id))
    ay = ay_res.scalar_one_or_none()

    class_name = "—"
    section_name = "—"
    if student.section_id:
        sec_res = await db.execute(select(Section).where(Section.id == student.section_id))
        sec = sec_res.scalar_one_or_none()
        if sec:
            section_name = sec.name
            cls_res = await db.execute(select(SchoolClass).where(SchoolClass.id == sec.class_id))
            cls_val = cls_res.scalar_one_or_none()
            if cls_val:
                class_name = cls_val.name

    sch_res = await db.execute(
        select(ExamSchedule).where(
            ExamSchedule.exam_id == exam.id,
            ExamSchedule.section_id == student.section_id,
            ExamSchedule.is_deleted.is_(False)
        )
    )
    schedules = sch_res.scalars().all()

    subject_marks = []
    total_max = 0.0
    total_obtained = 0.0
    is_passed = True
    remarks = None

    for sched in schedules:
        subj_res = await db.execute(select(Subject).where(Subject.id == sched.subject_id))
        subj = subj_res.scalar_one_or_none()

        mark_res = await db.execute(
            select(ExamMark).where(
                ExamMark.exam_schedule_id == sched.id,
                ExamMark.student_id == student.id,
                ExamMark.is_deleted.is_(False)
            )
        )
        mark = mark_res.scalar_one_or_none()

        obtained = float(mark.marks_obtained) if mark else 0.0
        max_m = float(sched.max_marks)
        pass_m = float(sched.pass_marks)

        total_max += max_m
        total_obtained += obtained
        if mark and mark.remarks:
            remarks = mark.remarks
        if obtained < pass_m:
            is_passed = False

        subject_marks.append({
            "subject_name": subj.name if subj else "Subject",
            "subject_code": subj.code if subj else "—",
            "max_marks": max_m,
            "pass_marks": pass_m,
            "marks_obtained": obtained,
        })

    percentage = round((total_obtained / total_max * 100.0), 2) if total_max > 0 else 0.0
    grade = calculate_cbse_grade(percentage)

    context = {
        "exam_name": exam.name,
        "student_name": f"{student.first_name} {student.last_name}",
        "admission_number": student.admission_number,
        "class_name": class_name,
        "section_name": section_name,
        "roll_number": student.roll_number,
        "dob": student.date_of_birth.strftime("%d %b %Y") if student.date_of_birth else "—",
        "academic_year": ay.name if ay else "Current Session",
        "subject_marks": subject_marks,
        "total_obtained": total_obtained,
        "total_max": total_max,
        "percentage": percentage,
        "grade": grade,
        "is_passed": is_passed,
        "remarks": remarks,
    }

    try:
        pdf_bytes = generate_pdf("report_card.html", context)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename=report_card_{student.admission_number}.pdf"}
        )
    except Exception as e:
        logger.error(f"Report Card PDF generation failed: {e}")
        from jinja2 import Environment, FileSystemLoader
        import os
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        env = Environment(loader=FileSystemLoader(os.path.join(BASE_DIR, "templates")))
        html_content = env.get_template("report_card.html").render(context)
        return Response(content=html_content, media_type="text/html")


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
    _: User = Depends(require_permission("exams:manage")),
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
    _: User = Depends(require_permission("exams:manage")),
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
