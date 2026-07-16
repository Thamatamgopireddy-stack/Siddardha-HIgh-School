import logging
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.session import get_db
from app.models import Student, User, ExamMark, Attendance

logger = logging.getLogger("siddardha")

router = APIRouter(prefix="/ai", tags=["ai"])


# Pydantic Schemas
class ChatRequest(BaseModel):
    message: str


class PredictRequest(BaseModel):
    student_id: UUID


# Endpoints
@router.post("/chat")
async def chat_assistant(
    body: ChatRequest,
    user: User = Depends(require_permission("dashboard:view")),
):
    msg = body.message.lower()
    
    # Simple semantic rule router for mock replies
    if "student" in msg or "promote" in msg:
        reply = "You can manage students in the Student Information System (SIS) panel, register new enrollments, upload academic documents, or promote them between academic sessions using the promotion drawer."
    elif "fee" in msg or "payment" in msg:
        reply = "The Fees & Accounts ledger allows you to create fee structure structures, log payments, and print PDF receipts using the invoice generator tool."
    elif "exam" in msg or "grade" in msg or "mark" in msg:
        reply = "The Examination panel lets you schedule subject evaluations, input students' grades, and view the report card worksheets."
    elif "absent" in msg or "attendance" in msg:
        reply = "Attendance registers can be logged daily. Note that marking a student as ABSENT will trigger an automated parent SMS notification alert."
    else:
        reply = f"Hello {user.first_name}, I am your Siddardha High School ERP Assistant. I can help you answer questions about student demographics, outstanding fees, or exam schedules. How can I help you today?"

    return success_response(data={"response": reply})


@router.post("/predict-performance")
async def predict_performance(
    body: PredictRequest,
    _: User = Depends(require_permission("exams:view")),
    db: AsyncSession = Depends(get_db),
):
    # Fetch student
    res = await db.execute(select(Student).where(Student.id == str(body.student_id)))
    student = res.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Fetch marks
    marks_res = await db.execute(select(ExamMark).where(ExamMark.student_id == str(body.student_id)))
    marks = list(marks_res.scalars().all())
    
    avg_marks = sum(float(m.marks_obtained) for m in marks) / len(marks) if marks else 75.0

    # Fetch attendance
    att_res = await db.execute(select(Attendance).where(Attendance.student_id == str(body.student_id)))
    att = list(att_res.scalars().all())
    
    present_count = sum(1 for a in att if a.status == "present")
    total_count = len(att)
    attendance_pct = (present_count / total_count * 100.0) if total_count > 0 else 92.5

    # Mock predictions
    predicted_score = min(100.0, avg_marks * 1.05) if attendance_pct > 80 else max(33.0, avg_marks * 0.85)
    
    risk_level = "Low Risk"
    if attendance_pct < 75.0 or avg_marks < 50.0:
        risk_level = "High Risk"
    elif attendance_pct < 85.0 or avg_marks < 65.0:
        risk_level = "Moderate Risk"

    recommendations = [
        "Encourage participation in after-school remedial sessions.",
        "Ensure parent is updated on current class work updates.",
    ]
    if risk_level == "High Risk":
        recommendations.append("Schedule a physical parent-teacher alignment meeting.")
    else:
        recommendations.append("Provide advanced worksheets to maintain classroom engagement.")

    return success_response(data={
        "student_name": f"{student.first_name} {student.last_name}",
        "attendance_rate": round(attendance_pct, 1),
        "current_average": round(avg_marks, 1),
        "predicted_next_exam_score": round(predicted_score, 1),
        "risk_level": risk_level,
        "recommendations": recommendations
    })
