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
                "You MUST act like Gemini/GPT — polite, articulate, intelligent, and formatting with Markdown. "
                "CRITICAL CONSTRAINT: You must answer questions ONLY based on Siddardha High School data. "
                "If the user asks non-school or external trivia questions (e.g. general science, coding, politics, weather, recipes), "
                "you MUST politely refuse and state that you only answer questions related to Siddardha High School records.\n\n"
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
                            "Format responses elegantly in Gemini/GPT style with Markdown. "
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
    user_name = f"{current_user.first_name} {current_user.last_name}" if current_user else "Administrator"
    query_str = body.message.strip()
    q_lower = query_str.lower()

    # Gather live system stats for context
    tot_students = (await db.execute(select(func.count(Student.id)).where(Student.is_deleted.is_(False)))).scalar() or 0
    tot_staff = (await db.execute(select(func.count(Staff.id)).where(Staff.is_deleted.is_(False)))).scalar() or 0
    tot_revenue = float((await db.execute(select(func.sum(FeePayment.amount_paid)).where(FeePayment.is_deleted.is_(False)))).scalar() or 0.0)
    tot_exams = (await db.execute(select(func.count(Exam.id)).where(Exam.is_deleted.is_(False)))).scalar() or 0
    tot_books = (await db.execute(select(func.count(Book.id)).where(Book.is_deleted.is_(False)))).scalar() or 0
    tot_classes = (await db.execute(select(func.count(SchoolClass.id)))).scalar() or 0

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

    # 1. Check if external LLM (Gemini or OpenAI API) is configured
    llm_response = await call_external_llm(query_str, db_summary)
    if llm_response:
        return success_response(data={"response": llm_response})

    # 2. Advanced Internal Gemini/GPT-style School AI Agent Engine
    try:
        # Check non-school / out-of-scope queries first
        non_school_keywords = [
            "capital of", "weather in", "recipe", "who is the president", "cricket world cup",
            "write code for", "tell me a joke", "movie", "song", "who created earth", "python script",
            "solve math equation x^2", "quantum physics", "bitcoin", "crypto"
        ]
        if any(k in q_lower for k in non_school_keywords):
            reply = (
                f"### 🤖 Siddardha High School AI Assistant\n\n"
                f"Hello **{user_name}**! I am an AI assistant specifically trained for **Siddardha High School**.\n\n"
                f"🔒 **Domain Guardrail Notice:**\n"
                f"I am restricted to answering questions strictly regarding **Siddardha High School data**, "
                f"including student records, fee collections, attendance registers, staff directory, exam marks, transport, and notices.\n\n"
                f"How can I assist you with your school records today?"
            )
            return success_response(data={"response": reply})

        # GREETINGS
        if q_lower in ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "who are you", "help"]:
            reply = (
                f"### 👋 Welcome to Siddardha High School AI Assistant\n\n"
                f"Hello **{user_name}**! I am your intelligent AI query engine with real-time access to the live school database.\n\n"
                f"#### 📊 Current Live Database Snapshot:\n"
                f"- 🎓 **Active Students:** {tot_students} registered\n"
                f"- 👥 **Faculty & Staff:** {tot_staff} active members\n"
                f"- 💳 **Total Fee Revenue:** ₹{tot_revenue:,.2f}\n"
                f"- 🏫 **Classes & Sections:** Class 6 to 10 (A, B, G)\n"
                f"- 📖 **Library Catalog:** {tot_books} books\n\n"
                f"#### 💡 Example Queries You Can Ask:\n"
                f"- *\"Find student Rahul\"*\n"
                f"- *\"Show total fee collection summary\"*\n"
                f"- *\"What is today's attendance rate?\"*\n"
                f"- *\"List faculty members in Science department\"*\n"
                f"- *\"Show scheduled examinations\"*\n"
                f"- *\"List notices published on notice board\"*"
            )
            return success_response(data={"response": reply})

        # STUDENT QUERIES (search student by name, roll no, admission no, village, gender, class/section)
        if any(k in q_lower for k in ["student", "enrolled", "roll", "admission", "boy", "girl", "class 6", "class 7", "class 8", "class 9", "class 10", "section", "find", "search", "who is"]):
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

            stmt = stmt.order_by(Student.first_name).limit(15)
            res = await db.execute(stmt)
            students = res.scalars().all()

            if students:
                student_rows = "\n".join([
                    f"1. **{s.first_name} {s.last_name}** — Adm No: `{s.admission_number}` | Roll: `{s.roll_number or 'N/A'}` | Gender: `{s.gender.value if hasattr(s.gender, 'value') else s.gender}` | Contact: `{s.phone or 'N/A'}`"
                    for s in students
                ])
                reply = (
                    f"### 🎓 Student Directory Search Results\n\n"
                    f"I searched the live student database for **\"{query_str}\"** and found **{len(students)}** matching record(s) out of **{tot_students}** total registered students:\n\n"
                    f"{student_rows}\n\n"
                    f"💡 *Tip: Click on Students in the sidebar for full profiles, document attachments, and promotion management.*"
                )
            else:
                reply = (
                    f"### 🎓 Student Search Results\n\n"
                    f"No matching student records found for **\"{query_str}\"**.\n\n"
                    f"- **Total Registered Students in Database:** {tot_students}\n"
                    f"- **Supported Search Fields:** First Name, Last Name, Admission Number, Roll Number, Village Name.\n\n"
                    f"💡 *You can add or import new students using the **Admissions** or **Students** module.*"
                )
            return success_response(data={"response": reply})

        # FEE & FINANCIAL QUERIES
        elif any(k in q_lower for k in ["fee", "payment", "collection", "due", "balance", "amount", "revenue", "paid", "receipt", "account"]):
            fee_count = (await db.execute(select(func.count(FeePayment.id)).where(FeePayment.is_deleted.is_(False)))).scalar() or 0
            structures_res = await db.execute(select(FeeStructure).where(FeeStructure.is_deleted.is_(False)))
            structures = structures_res.scalars().all()

            struct_rows = "\n".join([
                f"- **{fs.name}**: ₹{float(fs.amount):,.2f} ({fs.frequency})"
                for fs in structures
            ]) if structures else "No fee structures configured."

            payments_res = await db.execute(
                select(FeePayment).where(FeePayment.is_deleted.is_(False)).order_by(FeePayment.created_at.desc()).limit(5)
            )
            recent_payments = payments_res.scalars().all()

            payment_rows = "\n".join([
                f"- Receipt `{p.receipt_number}` | Amount: **₹{float(p.amount_paid):,.2f}** | Date: `{p.payment_date}`"
                for p in recent_payments
            ]) if recent_payments else "No recent payment receipts logged."

            reply = (
                f"### 💳 Fee Collections & Financial Analytics\n\n"
                f"- 💰 **Total Revenue Collected:** **₹{tot_revenue:,.2f}**\n"
                f"- 🧾 **Total Receipts Logged:** **{fee_count}** payments\n\n"
                f"#### 📋 Active School Fee Structures:\n{struct_rows}\n\n"
                f"#### 🕒 Recent Payment Receipts:\n{payment_rows}\n\n"
                f"💡 *Manage fee collections, generate receipts, or view pending balances in the **Fees & Accounts** section.*"
            )
            return success_response(data={"response": reply})

        # ATTENDANCE QUERIES
        elif any(k in q_lower for k in ["attendance", "absent", "present", "leave", "daily", "assembly"]):
            total_att = (await db.execute(select(func.count(Attendance.id)))).scalar() or 0
            present_count = (await db.execute(select(func.count(Attendance.id)).where(Attendance.status == "present"))).scalar() or 0
            absent_count = (await db.execute(select(func.count(Attendance.id)).where(Attendance.status == "absent"))).scalar() or 0

            rate = (present_count / total_att * 100.0) if total_att > 0 else 95.0

            reply = (
                f"### 📅 Daily Attendance Summary & Insights\n\n"
                f"- 📊 **Overall Attendance Rate:** **{rate:.1f}%**\n"
                f"- ✅ **Present Logs:** {present_count}\n"
                f"- ❌ **Absent Logs:** {absent_count}\n"
                f"- 📝 **Total Logged Entries:** {total_att}\n\n"
                f"💡 *Mark daily class registers or send automatic SMS alerts to absent parents in the **Attendance** module.*"
            )
            return success_response(data={"response": reply})

        # EXAMINATIONS & MARKS
        elif any(k in q_lower for k in ["exam", "mark", "grade", "score", "result", "topper", "pass", "test"]):
            exams_res = await db.execute(select(Exam).where(Exam.is_deleted.is_(False)))
            exams = exams_res.scalars().all()
            total_marks_cnt = (await db.execute(select(func.count(ExamMark.id)))).scalar() or 0

            exam_rows = "\n".join([
                f"- **{e.name}** | Type: `{e.exam_type}` | Published: `{e.is_published}`"
                for e in exams
            ]) if exams else "No examination schedules created."

            reply = (
                f"### 📚 Examinations & Academic Performance\n\n"
                f"- 📝 **Scheduled/Recorded Exams:** {len(exams)}\n"
                f"- 📊 **Student Subject Marks Recorded:** {total_marks_cnt}\n\n"
                f"#### 📅 Active Examination Modules:\n{exam_rows}\n\n"
                f"💡 *Configure exam timetables, record marks, or print report cards in the **Examinations** module.*"
            )
            return success_response(data={"response": reply})

        # STAFF & TEACHERS
        elif any(k in q_lower for k in ["teacher", "staff", "faculty", "employee", "salary", "payroll", "hr"]):
            staff_res = await db.execute(
                select(Staff, User).join(User, User.id == Staff.user_id).where(Staff.is_deleted.is_(False)).limit(10)
            )
            staff_members = staff_res.all()

            staff_rows = "\n".join([
                f"- **{user.first_name} {user.last_name}** | Emp ID: `{staff.employee_id}` | Department: `{staff.department or 'General'}` | Role: `{user.role.value if hasattr(user.role, 'value') else user.role}`"
                for staff, user in staff_members
            ]) if staff_members else "No faculty staff profiles created."

            reply = (
                f"### 👥 Faculty & Staff Directory\n\n"
                f"- 🏫 **Total Active Staff:** **{tot_staff}** members\n\n"
                f"#### 📋 Faculty Members:\n{staff_rows}\n\n"
                f"💡 *Manage staff profiles, designations, leave applications, and monthly salaries in **HR & Payroll**.*"
            )
            return success_response(data={"response": reply})

        # ANCILLARY (LIBRARY / TRANSPORT / HOSTELS)
        elif any(k in q_lower for k in ["book", "library", "bus", "transport", "route", "vehicle", "hostel", "room"]):
            books_res = await db.execute(select(Book).where(Book.is_deleted.is_(False)).limit(5))
            books = books_res.scalars().all()
            book_rows = "\n".join([f"- **{b.title}** by *{b.author}* (Available: {b.available_quantity}/{b.quantity})" for b in books]) if books else "No books cataloged."

            routes_res = await db.execute(select(TransportRoute).where(TransportRoute.is_deleted.is_(False)).limit(5))
            routes = routes_res.scalars().all()
            route_rows = "\n".join([f"- **{r.name}** ({r.start_point} &rarr; {r.end_point})" for r in routes]) if routes else "No transport routes."

            hostels_res = await db.execute(select(Hostel).where(Hostel.is_deleted.is_(False)))
            hostels = hostels_res.scalars().all()
            hostel_rows = "\n".join([f"- **{h.name}** ({h.hostel_type.title()} Hostel, Capacity: {h.capacity})" for h in hostels]) if hostels else "No hostels configured."

            reply = (
                f"### 🏫 Campus Facilities & Ancillary Services\n\n"
                f"#### 📖 Library Catalog ({tot_books} books total):\n{book_rows}\n\n"
                f"#### 🚌 Transport Network:\n{route_rows}\n\n"
                f"#### 🏢 Residential Hostels:\n{hostel_rows}\n\n"
                f"💡 *Manage book issue/return, bus routes, or hostel room allocations in their respective sidebar modules.*"
            )
            return success_response(data={"response": reply})

        # NOTICE BOARD & CIRCULARS
        elif any(k in q_lower for k in ["notice", "board", "circular", "announcement", "news"]):
            circ_res = await db.execute(select(Circular).where(Circular.is_published.is_(True), Circular.is_deleted.is_(False)).limit(5))
            circulars = circ_res.scalars().all()

            circ_rows = "\n".join([
                f"- 📢 **{c.title}** | Target: `{c.target_role}`"
                for c in circulars
            ]) if circulars else "No notices published yet."

            reply = (
                f"### 📢 Notice Board & Official Circulars\n\n"
                f"#### Active Published Announcements:\n{circ_rows}\n\n"
                f"💡 *Publish school announcements or attach PDF circulars in the **Noticeboard** section.*"
            )
            return success_response(data={"response": reply})

        # DEFAULT SYSTEM EXECUTIVE OVERVIEW
        else:
            reply = (
                f"### 🏫 Siddardha High School Live System Dashboard\n\n"
                f"Hello **{user_name}**! Here is the latest executive summary from our live SQL database:\n\n"
                f"- 🎓 **Registered Students:** **{tot_students}** active students\n"
                f"- 👥 **Faculty & Staff:** **{tot_staff}** staff members\n"
                f"- 💳 **Total Fee Revenue:** **₹{tot_revenue:,.2f}**\n"
                f"- 📚 **Examinations Scheduled:** **{tot_exams}** exams\n"
                f"- 📖 **Library Books:** **{tot_books}** cataloged\n\n"
                f"#### 💡 How I can help you:\n"
                f"You can ask me questions about Siddardha High School data in natural conversational language. For example:\n"
                f"- *\"Find student Rahul\"*\n"
                f"- *\"Show fee collection summary\"*\n"
                f"- *\"What is today's attendance rate?\"*\n"
                f"- *\"List faculty members\"*\n"
                f"- *\"Show available library books\"*"
            )
            return success_response(data={"response": reply})

    except Exception as e:
        logger.error(f"Error executing AI query: {e}")
        return success_response(
            data={
                "response": f"I encountered an error querying the database ({e}). Please try rephrasing your question."
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
