import logging
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.session import get_db
from app.models import Student, Parent, Section, SchoolClass, Attendance, FeeStructure, FeePayment, User
from app.utils.pdf import generate_pdf

logger = logging.getLogger("siddardha")

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/attendance-summary")
async def get_attendance_summary(
    _: User = Depends(require_permission("reports:view")),
    db: AsyncSession = Depends(get_db),
):
    # Fetch all sections
    sections_res = await db.execute(select(Section).where(Section.is_deleted.is_(False)))
    sections = sections_res.scalars().all()
    
    data = []
    for sec in sections:
        # Get class name
        class_res = await db.execute(select(SchoolClass).where(SchoolClass.id == sec.class_id))
        cls = class_res.scalar_one_or_none()
        class_name = cls.name if cls else "Unknown Class"
        
        # Calculate attendance statistics
        att_res = await db.execute(select(Attendance).where(Attendance.section_id == sec.id, Attendance.is_deleted.is_(False)))
        records = list(att_res.scalars().all())
        
        total = len(records)
        present = sum(1 for r in records if r.status == "present")
        rate = (present / total * 100.0) if total > 0 else 100.0
        
        data.append({
            "section_id": sec.id,
            "class_name": class_name,
            "section_name": sec.name,
            "present_days": present,
            "total_days": total,
            "rate": round(rate, 1)
        })
        
    return success_response(data=data)


@router.get("/fee-outstanding")
async def get_fee_outstanding(
    _: User = Depends(require_permission("reports:view")),
    db: AsyncSession = Depends(get_db),
):
    # Calculate sum of all fee structure structures (as a general aggregate total per student)
    structs_res = await db.execute(select(FeeStructure).where(FeeStructure.is_deleted.is_(False)))
    structures = list(structs_res.scalars().all())
    total_mandatory_demand = sum(float(s.amount) for s in structures if s.is_mandatory)

    # Fetch total students
    students_res = await db.execute(select(Student).where(Student.is_deleted.is_(False)))
    students = list(students_res.scalars().all())
    total_expected = len(students) * total_mandatory_demand
    
    # Calculate total collected payments
    payments_res = await db.execute(select(FeePayment).where(FeePayment.is_deleted.is_(False)))
    payments = list(payments_res.scalars().all())
    total_collected = sum(float(p.amount_paid) for p in payments)
    
    total_outstanding = max(0.0, total_expected - total_collected)
    
    return success_response(data={
        "total_expected": round(total_expected, 2),
        "total_collected": round(total_collected, 2),
        "total_outstanding": round(total_outstanding, 2),
    })


@router.get("/certificates/issue")
async def issue_student_certificate(
    student_id: UUID = Query(...),
    cert_type: str = Query("Bonafide Certificate"),  # Bonafide, Transfer, Character
    _: User = Depends(require_permission("reports:view")),
    db: AsyncSession = Depends(get_db),
):
    student_res = await db.execute(select(Student).where(Student.id == str(student_id), Student.is_deleted.is_(False)))
    student = student_res.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")
        
    # Get parents
    father_query = select(Parent).where(Parent.student_id == student.id, Parent.relation == "father")
    mother_query = select(Parent).where(Parent.student_id == student.id, Parent.relation == "mother")
    
    father = (await db.execute(father_query)).scalar_one_or_none()
    mother = (await db.execute(mother_query)).scalar_one_or_none()
    
    father_name = f"{father.first_name} {father.last_name}".strip() if father else "Shri Sharma"
    mother_name = f"{mother.first_name} {mother.last_name}".strip() if mother else "Shrimati Sharma"
    
    # Get class name
    sec_res = await db.execute(select(Section).where(Section.id == student.section_id))
    sec = sec_res.scalar_one_or_none()
    cls_name = "—"
    if sec:
        cls_res = await db.execute(select(SchoolClass).where(SchoolClass.id == sec.class_id))
        cls = cls_res.scalar_one_or_none()
        cls_name = f"{cls.name} - {sec.name}" if cls else sec.name

    context = {
        "certificate_title": cert_type.upper(),
        "student_name": f"{student.first_name} {student.last_name}".upper(),
        "father_name": father_name,
        "mother_name": mother_name,
        "admission_number": student.admission_number,
        "class_name": cls_name,
        "dob": student.date_of_birth.strftime("%d %b %Y") if student.date_of_birth else "—",
        "conduct": "EXCELLENT",
        "issue_date": date.today().strftime("%d %b %Y"),
    }
    
    try:
        pdf_bytes = generate_pdf("certificate.html", context)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename=certificate_{student.admission_number}.pdf"}
        )
    except Exception as e:
        logger.error(f"Certificate PDF generation failed: {e}")
        # Return fallback HTML representation when running in local environments lacking libgobject
        from jinja2 import Environment, FileSystemLoader
        import os
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        env = Environment(loader=FileSystemLoader(os.path.join(BASE_DIR, "templates")))
        html_content = env.get_template("certificate.html").render(context)
        return Response(content=html_content, media_type="text/html")
