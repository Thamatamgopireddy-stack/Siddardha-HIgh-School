import logging
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.session import get_db
from app.models import (
    Student, Parent, User, SchoolClass, Section, AcademicYear,
    Attendance, FeeInvoice, FeePayment, Exam, ExamSchedule, ExamMark,
    Subject, Circular
)
from app.routers.exams import calculate_cbse_grade

logger = logging.getLogger("educore")

router = APIRouter(prefix="/portal", tags=["portal"])


async def _get_linked_children(user: User, db: AsyncSession) -> list[dict]:
    """Returns all student records linked to a logged-in parent or student user."""
    students = []
    if user.role == "student":
        st_res = await db.execute(select(Student).where(Student.user_id == user.id, Student.is_deleted.is_(False)))
        st = st_res.scalar_one_or_none()
        if st:
            students.append(st)
    elif user.role == "parent":
        # Find all parent entries for user.id or user.phone
        p_res = await db.execute(
            select(Parent).where(
                or_(Parent.user_id == user.id, Parent.phone == user.phone),
                Parent.is_deleted.is_(False)
            )
        )
        parents = p_res.scalars().all()
        student_ids = [p.student_id for p in parents if p.student_id]

        if student_ids:
            st_res = await db.execute(select(Student).where(Student.id.in_(student_ids), Student.is_deleted.is_(False)))
            st_dict = {s.id: s for s in st_res.scalars().all()}
            students = [st_dict[sid] for sid in student_ids if sid in st_dict]

    children_data = []
    for s in students:
        class_name = "—"
        section_name = "—"
        if s.section_id:
            sec_res = await db.execute(select(Section).where(Section.id == s.section_id))
            sec = sec_res.scalar_one_or_none()
            if sec:
                section_name = sec.name
                cls_res = await db.execute(select(SchoolClass).where(SchoolClass.id == sec.class_id))
                cls_val = cls_res.scalar_one_or_none()
                if cls_val:
                    class_name = cls_val.name

        children_data.append({
            "student_id": s.id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "admission_number": s.admission_number,
            "roll_number": s.roll_number,
            "class_name": class_name,
            "section_name": section_name,
        })
    return children_data


@router.get("/my-children")
async def get_my_children(
    current_user: User = Depends(require_permission("students:view")),
    db: AsyncSession = Depends(get_db),
):
    children = await _get_linked_children(current_user, db)
    return success_response(data=children)


@router.get("/overview")
async def get_portal_overview(
    student_id: UUID | None = Query(None),
    current_user: User = Depends(require_permission("students:view")),
    db: AsyncSession = Depends(get_db),
):
    children = await _get_linked_children(current_user, db)
    if not children:
        return success_response(data={
            "children": [],
            "active_student": None,
            "attendance": None,
            "fees": None,
            "exams": None,
            "announcements": []
        })

    # Select active child
    active_child_info = children[0]
    if student_id:
        target_str = str(student_id)
        matched = next((c for c in children if c["student_id"] == target_str), None)
        if matched:
            active_child_info = matched
        elif current_user.role in ("student", "parent"):
            raise HTTPException(status_code=403, detail="Access denied for selected student")

    target_student_id = active_child_info["student_id"]

    # Fetch active student model
    st_res = await db.execute(select(Student).where(Student.id == target_student_id))
    active_student = st_res.scalar_one_or_none()

    # ------------------------------------------------------------------
    # 1. ATTENDANCE MODULE SUMMARY
    # ------------------------------------------------------------------
    att_res = await db.execute(
        select(Attendance).where(Attendance.student_id == target_student_id, Attendance.is_deleted.is_(False))
        .order_by(Attendance.date.desc())
    )
    att_records = att_res.scalars().all()

    total_att = len(att_records)
    present_att = sum(1 for a in att_records if (a.status.value.lower() if hasattr(a.status, 'value') else str(a.status).lower()) in ("present", "late"))
    absent_att = sum(1 for a in att_records if (a.status.value.lower() if hasattr(a.status, 'value') else str(a.status).lower()) == "absent")
    att_rate = round((present_att / total_att * 100.0), 1) if total_att > 0 else 100.0

    recent_att_logs = [
        {
            "date": a.date.isoformat(),
            "status": str(a.status.value) if hasattr(a.status, 'value') else str(a.status),
        }
        for a in att_records[:5]
    ]

    attendance_summary = {
        "overall_percentage": att_rate,
        "total_sessions": total_att,
        "present_days": present_att,
        "absent_days": absent_att,
        "recent_logs": recent_att_logs
    }

    # ------------------------------------------------------------------
    # 2. FEES MODULE SUMMARY
    # ------------------------------------------------------------------
    inv_res = await db.execute(
        select(FeeInvoice).where(FeeInvoice.student_id == target_student_id, FeeInvoice.is_deleted.is_(False))
    )
    invoices = inv_res.scalars().all()

    total_mandated = sum(float(i.amount_due) for i in invoices)
    total_paid = sum(float(i.amount_paid) for i in invoices)
    net_outstanding = max(0.0, total_mandated - total_paid)

    next_due_date = None
    unpaid_invoices = [i for i in invoices if i.status in ("unpaid", "partial", "overdue")]
    if unpaid_invoices:
        next_due_date = min(i.due_date for i in unpaid_invoices).isoformat()

    fees_summary = {
        "total_mandated": total_mandated,
        "total_paid": total_paid,
        "net_outstanding": net_outstanding,
        "next_due_date": next_due_date,
        "active_invoices_count": len(unpaid_invoices),
        "invoices": [
            {
                "id": i.id,
                "invoice_number": i.invoice_number,
                "title": i.title,
                "amount_due": float(i.amount_due),
                "amount_paid": float(i.amount_paid),
                "due_date": i.due_date.isoformat(),
                "status": i.status
            }
            for i in invoices
        ]
    }

    # ------------------------------------------------------------------
    # 3. EXAMS MODULE SUMMARY (Most Recent Published Exam)
    # ------------------------------------------------------------------
    exam_summary = None
    if active_student:
        ex_res = await db.execute(
            select(Exam)
            .join(ExamSchedule, ExamSchedule.exam_id == Exam.id)
            .where(
                Exam.academic_year_id == active_student.academic_year_id,
                ExamSchedule.section_id == active_student.section_id,
                Exam.is_published == True,
                Exam.is_deleted.is_(False),
                ExamSchedule.is_deleted.is_(False)
            )
            .order_by(Exam.created_at.desc())
            .limit(1)
        )
        latest_exam = ex_res.scalar_one_or_none()

        if latest_exam:
            sch_res = await db.execute(
                select(ExamSchedule).where(
                    ExamSchedule.exam_id == latest_exam.id,
                    ExamSchedule.section_id == active_student.section_id,
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
                        ExamMark.student_id == active_student.id,
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

            exam_summary = {
                "exam_id": latest_exam.id,
                "exam_name": latest_exam.name,
                "total_obtained": total_obtained,
                "total_max": total_max,
                "percentage": percentage,
                "grade": grade,
                "is_passed": is_passed,
                "subject_marks": subject_marks
            }

    # ------------------------------------------------------------------
    # 4. ANNOUNCEMENTS / CIRCULARS SUMMARY
    # ------------------------------------------------------------------
    target_roles = ["all"]
    if current_user.role in ("parent", "student"):
        target_roles.append(current_user.role)

    circ_res = await db.execute(
        select(Circular).where(
            Circular.target_role.in_(target_roles),
            Circular.is_published == True,
            Circular.is_deleted.is_(False)
        ).order_by(Circular.created_at.desc()).limit(5)
    )
    circulars = circ_res.scalars().all()

    announcements = [
        {
            "id": c.id,
            "title": c.title,
            "content": c.content,
            "target_role": c.target_role,
            "published_at": c.published_at.isoformat() if c.published_at else c.created_at.isoformat()
        }
        for c in circulars
    ]

    return success_response(data={
        "children": children,
        "active_student": active_child_info,
        "attendance": attendance_summary,
        "fees": fees_summary,
        "exams": exam_summary,
        "announcements": announcements
    })
