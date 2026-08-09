import logging
import re
import os
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import success_response
from app.core.security import decode_token
from app.core.session import get_db
from app.models import (
    Student, User, Staff, Attendance, FeePayment, FeeStructure,
    Exam, ExamSchedule, ExamMark, Book, BookIssue, Circular, SchoolClass,
    Section, TransportRoute, Vehicle, Hostel, HostelRoom, Subject
)

logger = logging.getLogger("siddardha.ai")

router = APIRouter(prefix="/ai", tags=["ai"])


class ChatRequest(BaseModel):
    message: str


class PredictRequest(BaseModel):
    student_id: UUID


async def get_optional_user(
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> User | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization[7:]
        payload = decode_token(token)
        user_id = payload.get("sub")
        if user_id:
            result = await db.execute(select(User).where(User.id == user_id, User.is_deleted.is_(False)))
            return result.scalar_one_or_none()
    except Exception:
        pass
    return None


async def call_external_llm(user_message: str, db_context: str) -> str | None:
    """
    Optional LLM integration using Gemini API or OpenAI API if configured.
    """
    gemini_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            system_instruction = (
                "You are the official Siddardha High School AI Assistant. "
                "Respond naturally like Gemini/GPT — polite, concise, articulate, and direct using Markdown. "
                "IMPORTANT: Answer ONLY the specific question asked. Do NOT dump unnecessary metrics or lists of example questions. "
                "CRITICAL CONSTRAINT: You must answer questions ONLY based on Siddardha High School data. "
                "If the user asks non-school or external trivia questions, politely decline in 1 short sentence.\n\n"
                f"LIVE SCHOOL DATABASE CONTEXT:\n{db_context}"
            )
            prompt = f"{system_instruction}\n\nUSER QUESTION: {user_message}"
            res = model.generate_content(prompt)
            if res and res.text:
                return res.text.strip()
        except Exception as e:
            logger.warning(f"Gemini API call failed, falling back to NLP engine: {e}")

    openai_key = settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")
    if openai_key:
        try:
            import urllib.request
            import json
            req_data = {
                "model": "gpt-3.5-turbo",
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are the official Siddardha High School AI Assistant. "
                            "Respond naturally like Gemini/GPT — concise, direct, and focused strictly on the question asked. "
                            "Do NOT output unnecessary system stats or unrelated overview data. "
                            "STRICT CONSTRAINT: Answer ONLY using the provided Siddardha High School data. "
                            "If asked out-of-scope non-school queries, politely decline."
                        )
                    },
                    {"role": "user", "content": f"DATABASE CONTEXT:\n{db_context}\n\nUSER QUERY: {user_message}"}
                ],
                "temperature": 0.3
            }
            req = urllib.request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=json.dumps(req_data).encode("utf-8"),
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {openai_key}"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return result["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning(f"OpenAI API call failed, falling back to NLP engine: {e}")

    return None


@router.post("/chat")
async def chat_assistant(
    body: ChatRequest,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    user_name = f"{current_user.first_name} {current_user.last_name}" if current_user else "Admin"
    query_str = body.message.strip()
    q_lower = query_str.lower()

    # 1. SIMPLE GREETINGS (Keep responses short & friendly, no data dumps!)
    if q_lower in ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "hi there", "hello there", "namaste"]:
        reply = f"Hello **{user_name}**! 👋 How can I help you with Siddardha High School data today?"
        return success_response(data={"response": reply})

    if q_lower in ["who are you", "what are you", "what can you do"]:
        reply = (
            f"I am the **Siddardha High School AI Assistant**.\n"
            f"I can help you search student records, check fee collections, attendance stats, staff directory, exam marks, transport, hostels, and circulars."
        )
        return success_response(data={"response": reply})

    # Gather live system stats for context (used for context or explicit overview requests)
    tot_students = (await db.execute(select(func.count(Student.id)).where(Student.is_deleted.is_(False)))).scalar() or 0
    tot_staff = (await db.execute(select(func.count(Staff.id)).where(Staff.is_deleted.is_(False)))).scalar() or 0
    tot_revenue = float((await db.execute(select(func.sum(FeePayment.amount_paid)).where(FeePayment.is_deleted.is_(False)))).scalar() or 0.0)
    tot_exams = (await db.execute(select(func.count(Exam.id)).where(Exam.is_deleted.is_(False)))).scalar() or 0
    tot_books = (await db.execute(select(func.count(Book.id)).where(Book.is_deleted.is_(False)))).scalar() or 0

    db_summary = (
        f"School Name: Siddardha High School\n"
        f"Board: CBSE | Academic Year: 2025-26\n"
        f"Total Registered Students: {tot_students}\n"
        f"Total Active Staff/Faculty: {tot_staff}\n"
        f"Total Fee Collections: ₹{tot_revenue:,.2f}\n"
        f"Classes Offered: Class 6 to Class 10 (Sections A, B, G)\n"
        f"Total Exam Modules: {tot_exams}\n"
        f"Library Catalog Size: {tot_books} books\n"
    )

    # Check external LLM first if configured
    llm_response = await call_external_llm(query_str, db_summary)
    if llm_response:
        return success_response(data={"response": llm_response})

    # 2. INTERNAL INTENT & QUESTION-FOCUSED ENGINE
    try:
        # Check non-school / out-of-scope queries
        non_school_keywords = [
            "capital of", "weather in", "recipe", "who is the president", "cricket world cup",
            "write code for", "tell me a joke", "movie", "song", "who created earth", "python script",
            "solve math equation", "quantum physics", "bitcoin", "crypto"
        ]
        if any(k in q_lower for k in non_school_keywords):
            reply = "I am the **Siddardha High School AI Assistant** and can only assist with Siddardha High School data and records. How can I help you with school data today?"
            return success_response(data={"response": reply})

        # TOTAL STUDENT COUNT ONLY
        if any(k in q_lower for k in ["count", "how many", "total number", "number of"]) and any(k in q_lower for k in ["student", "enrolled", "kid", "child"]):
            reply = f"There are currently **{tot_students}** registered active students in Siddardha High School."
            return success_response(data={"response": reply})

        # SPECIFIC STUDENT SEARCH (by name, roll no, admission no, village, etc.)
        if any(k in q_lower for k in ["student", "enrolled", "roll", "admission", "find", "search", "who is", "class 6", "class 7", "class 8", "class 9", "class 10"]):
            words = [w for w in re.split(r'\W+', query_str) if len(w) > 2 and w.lower() not in ["student", "students", "show", "find", "list", "search", "what", "who", "is", "the", "for", "with", "class", "section"]]
            
            stmt = select(Student).where(Student.is_deleted.is_(False))
            if words:
                filters = []
                for w in words[:4]:
                    filters.append(Student.first_name.ilike(f"%{w}%"))
                    filters.append(Student.last_name.ilike(f"%{w}%"))
                    filters.append(Student.admission_number.ilike(f"%{w}%"))
                    filters.append(Student.roll_number.ilike(f"%{w}%"))
                    filters.append(Student.address_line1.ilike(f"%{w}%"))
                stmt = stmt.where(or_(*filters))

            stmt = stmt.order_by(Student.first_name).limit(10)
            res = await db.execute(stmt)
            students = res.scalars().all()

            if students:
                student_rows = "\n".join([
                    f"- **{s.first_name} {s.last_name}** | Adm No: `{s.admission_number}` | Roll: `{s.roll_number or 'N/A'}` | Phone: `{s.phone or 'N/A'}`"
                    for s in students
                ])
                reply = f"### 🎓 Matching Students ({len(students)} found):\n{student_rows}"
            else:
                reply = f"No student records found matching **\"{query_str}\"**. (Total registered students in database: **{tot_students}**)."
            return success_response(data={"response": reply})

        # FEE & FINANCIAL QUERIES
        elif any(k in q_lower for k in ["fee", "payment", "collection", "due", "balance", "revenue", "paid", "receipt"]):
            fee_count = (await db.execute(select(func.count(FeePayment.id)).where(FeePayment.is_deleted.is_(False)))).scalar() or 0
            structures_res = await db.execute(select(FeeStructure).where(FeeStructure.is_deleted.is_(False)))
            structures = structures_res.scalars().all()

            struct_rows = "\n".join([
                f"- **{fs.name}**: ₹{float(fs.amount):,.2f} ({fs.frequency})"
                for fs in structures
            ]) if structures else "No fee structures configured."

            reply = (
                f"### 💳 Fee Summary\n"
                f"- **Total Revenue Collected:** **₹{tot_revenue:,.2f}** ({fee_count} receipts logged)\n\n"
                f"#### Active Fee Structures:\n{struct_rows}"
            )
            return success_response(data={"response": reply})

        # ATTENDANCE QUERIES
        elif any(k in q_lower for k in ["attendance", "absent", "present", "leave"]):
            total_att = (await db.execute(select(func.count(Attendance.id)))).scalar() or 0
            present_count = (await db.execute(select(func.count(Attendance.id)).where(Attendance.status == "present"))).scalar() or 0
            absent_count = (await db.execute(select(func.count(Attendance.id)).where(Attendance.status == "absent"))).scalar() or 0
            rate = (present_count / total_att * 100.0) if total_att > 0 else 95.0

            reply = (
                f"### 📅 Attendance Overview\n"
                f"- **Attendance Rate:** **{rate:.1f}%**\n"
                f"- **Present:** {present_count} | **Absent:** {absent_count} | **Total Logs:** {total_att}"
            )
            return success_response(data={"response": reply})

        # EXAMINATIONS & MARKS
        elif any(k in q_lower for k in ["exam", "mark", "grade", "score", "result", "topper", "test"]):
            exams_res = await db.execute(select(Exam).where(Exam.is_deleted.is_(False)))
            exams = exams_res.scalars().all()
            total_marks_cnt = (await db.execute(select(func.count(ExamMark.id)))).scalar() or 0

            exam_rows = "\n".join([
                f"- **{e.name}** ({e.exam_type})"
                for e in exams
            ]) if exams else "No exams scheduled."

            reply = (
                f"### 📚 Examinations ({len(exams)} scheduled)\n"
                f"Total Marks Records: **{total_marks_cnt}**\n\n"
                f"{exam_rows}"
            )
            return success_response(data={"response": reply})

        # STAFF & TEACHERS
        elif any(k in q_lower for k in ["teacher", "staff", "faculty", "employee", "salary", "payroll", "hr"]):
            staff_res = await db.execute(
                select(Staff, User).join(User, User.id == Staff.user_id).where(Staff.is_deleted.is_(False)).limit(10)
            )
            staff_members = staff_res.all()

            staff_rows = "\n".join([
                f"- **{user.first_name} {user.last_name}** | Dept: `{staff.department or 'General'}` | Emp ID: `{staff.employee_id}`"
                for staff, user in staff_members
            ]) if staff_members else "No staff records registered."

            reply = (
                f"### 👥 Staff Directory ({tot_staff} total)\n{staff_rows}"
            )
            return success_response(data={"response": reply})

        # LIBRARY / BOOKS ONLY
        elif any(k in q_lower for k in ["book", "library"]):
            books_res = await db.execute(select(Book).where(Book.is_deleted.is_(False)).limit(5))
            books = books_res.scalars().all()
            book_rows = "\n".join([f"- **{b.title}** by *{b.author}* (Available: {b.available_quantity}/{b.quantity})" for b in books]) if books else "No books in library."

            reply = f"### 📖 Library Books ({tot_books} total cataloged):\n{book_rows}"
            return success_response(data={"response": reply})

        # TRANSPORT / BUSES ONLY
        elif any(k in q_lower for k in ["bus", "transport", "route", "vehicle"]):
            routes_res = await db.execute(select(TransportRoute).where(TransportRoute.is_deleted.is_(False)).limit(5))
            routes = routes_res.scalars().all()
            route_rows = "\n".join([f"- **{r.name}** ({r.start_point} &rarr; {r.end_point})" for r in routes]) if routes else "No transport routes."

            reply = f"### 🚌 Transport Routes:\n{route_rows}"
            return success_response(data={"response": reply})

        # HOSTELS ONLY
        elif any(k in q_lower for k in ["hostel", "room"]):
            hostels_res = await db.execute(select(Hostel).where(Hostel.is_deleted.is_(False)))
            hostels = hostels_res.scalars().all()
            hostel_rows = "\n".join([f"- **{h.name}** ({h.hostel_type.title()} Hostel, Capacity: {h.capacity})" for h in hostels]) if hostels else "No hostels configured."

            reply = f"### 🏢 Hostels:\n{hostel_rows}"
            return success_response(data={"response": reply})

        # NOTICES ONLY
        elif any(k in q_lower for k in ["notice", "board", "circular", "announcement"]):
            circ_res = await db.execute(select(Circular).where(Circular.is_published.is_(True), Circular.is_deleted.is_(False)).limit(5))
            circulars = circ_res.scalars().all()

            circ_rows = "\n".join([
                f"- 📢 **{c.title}** (Target: {c.target_role})"
                for c in circulars
            ]) if circulars else "No active announcements."

            reply = f"### 📢 Notice Board:\n{circ_rows}"
            return success_response(data={"response": reply})

        # EXPLICIT SYSTEM OVERVIEW
        elif any(k in q_lower for k in ["overview", "summary", "dashboard", "system status"]):
            reply = (
                f"### 🏫 Siddardha High School System Overview\n"
                f"- 🎓 **Students:** {tot_students} registered\n"
                f"- 👥 **Staff:** {tot_staff} active\n"
                f"- 💳 **Revenue:** ₹{tot_revenue:,.2f}\n"
                f"- 📚 **Exams:** {tot_exams} scheduled\n"
                f"- 📖 **Library:** {tot_books} books"
            )
            return success_response(data={"response": reply})

        # DEFAULT FALLBACK FOR UNRECOGNIZED SCHOOL QUERY
        else:
            reply = f"I couldn't find specific records matching **\"{query_str}\"**. Please try asking specifically about students, fees, attendance, staff, exams, or notices."
            return success_response(data={"response": reply})

    except Exception as e:
        logger.error(f"Error executing AI query: {e}")
        return success_response(
            data={
                "response": "I encountered an error querying the database. Please try rephrasing your question."
            }
        )


@router.post("/predict-performance")
async def predict_performance(
    body: PredictRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        res = await db.execute(select(Student).where(Student.id == str(body.student_id)))
        student = res.scalar_one_or_none()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        marks_res = await db.execute(select(ExamMark).where(ExamMark.student_id == str(body.student_id)))
        marks = list(marks_res.scalars().all())
        avg_marks = sum(float(m.marks_obtained) for m in marks) / len(marks) if marks else 75.0

        att_res = await db.execute(select(Attendance).where(Attendance.student_id == str(body.student_id)))
        att = list(att_res.scalars().all())
        present_count = sum(1 for a in att if a.status == "present")
        total_count = len(att)
        attendance_pct = (present_count / total_count * 100.0) if total_count > 0 else 92.5

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
