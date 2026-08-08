import logging
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, success_response
from app.core.enums import UserRole, AttendanceStatus
from app.core.session import get_db
from app.models import Student, Staff, User, Attendance, FeePayment, TimetableEntry, Section, AuditLog, FeeStructure, Parent

logger = logging.getLogger("siddardha")

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = user.role
    
    if role in (UserRole.TEACHER, UserRole.CLASS_TEACHER):
        # Timetable entries for today
        day_name = datetime.now().strftime("%A")  # e.g., "Monday"
        classes_query = select(func.count(TimetableEntry.id)).where(
            TimetableEntry.teacher_id == str(user.id),
            TimetableEntry.day_of_week == day_name,
            TimetableEntry.is_deleted.is_(False)
        )
        classes_today = (await db.execute(classes_query)).scalar() or 0
        
        # Attendance Pending
        today = date.today()
        marked_sections_query = select(Attendance.section_id).where(
            Attendance.date == today,
            Attendance.is_deleted.is_(False)
        ).distinct()
        marked_sections_res = await db.execute(marked_sections_query)
        marked_section_ids = {r[0] for r in marked_sections_res.all()}
        
        all_sections_query = select(func.count(Section.id)).where(Section.is_deleted.is_(False))
        total_sections = (await db.execute(all_sections_query)).scalar() or 0
        attendance_pending = max(0, total_sections - len(marked_section_ids))
        
        return success_response(data={
            "role": role,
            "classes_today": classes_today,
            "attendance_pending": attendance_pending
        })
        
    elif role in (UserRole.STUDENT, UserRole.PARENT):
        # Student or Parent stats
        student = None
        if role == UserRole.STUDENT:
            student_res = await db.execute(
                select(Student).where(Student.user_id == str(user.id), Student.is_deleted.is_(False))
            )
            student = student_res.scalar_one_or_none()
        elif role == UserRole.PARENT:
            parent_res = await db.execute(
                select(Parent).where(Parent.user_id == str(user.id), Parent.is_deleted.is_(False))
            )
            parent = parent_res.scalar_one_or_none()
            if parent:
                student_res = await db.execute(
                    select(Student).where(Student.id == parent.student_id, Student.is_deleted.is_(False))
                )
                student = student_res.scalar_one_or_none()
                
        attendance_rate = "0.0%"
        fee_status = "N/A"
        
        if student:
            # Monthly attendance rate
            today = date.today()
            first_day = date(today.year, today.month, 1)
            att_query = select(Attendance.status).where(
                Attendance.student_id == student.id,
                Attendance.date >= first_day,
                Attendance.date <= today,
                Attendance.is_deleted.is_(False)
            )
            att_res = await db.execute(att_query)
            records = [r[0] for r in att_res.all()]
            if records:
                present = sum(1 for status in records if status in (AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.HALF_DAY))
                attendance_rate = f"{(present / len(records)) * 100:.1f}%"
            else:
                attendance_rate = "100.0%"  # Default if no records yet
                
            # Fee status
            paid_query = select(func.sum(FeePayment.amount_paid)).where(
                FeePayment.student_id == student.id,
                FeePayment.is_deleted.is_(False)
            )
            total_paid = (await db.execute(paid_query)).scalar() or 0.0
            
            struct_query = select(func.sum(FeeStructure.amount)).where(
                FeeStructure.academic_year_id == student.academic_year_id,
                FeeStructure.is_mandatory.is_(True),
                FeeStructure.is_deleted.is_(False)
            )
            total_expected = (await db.execute(struct_query)).scalar() or 0.0
            
            if total_expected == 0:
                fee_status = "Paid"
            elif total_paid >= total_expected:
                fee_status = "Paid"
            elif total_paid > 0:
                fee_status = "Partial"
            else:
                fee_status = "Unpaid"
                
        return success_response(data={
            "role": role,
            "attendance_rate": attendance_rate,
            "fee_status": fee_status
        })
        
    else:
        # Admin / Principal dashboard
        # 1. Total Students
        students_query = select(func.count(Student.id)).where(Student.is_deleted.is_(False))
        total_students = (await db.execute(students_query)).scalar() or 0
        
        # 2. Total Teachers
        teachers_query = select(func.count(User.id)).where(
            User.role.in_([UserRole.TEACHER, UserRole.CLASS_TEACHER]),
            User.is_deleted.is_(False)
        )
        total_teachers = (await db.execute(teachers_query)).scalar() or 0
        
        # 3. Fee Collected (Month)
        today = date.today()
        first_day = date(today.year, today.month, 1)
        fee_query = select(func.sum(FeePayment.amount_paid)).where(
            FeePayment.payment_date >= first_day,
            FeePayment.payment_date <= today,
            FeePayment.is_deleted.is_(False)
        )
        fee_collected = (await db.execute(fee_query)).scalar() or 0.0
        
        # Format collected fee
        if fee_collected >= 100000:
            fee_collected_str = f"₹{fee_collected/100000:.1f}L"
        else:
            fee_collected_str = f"₹{fee_collected:,.0f}"
            
        # 4. Avg Attendance Today
        att_query = select(Attendance.status).where(
            Attendance.date == today,
            Attendance.is_deleted.is_(False)
        )
        att_res = await db.execute(att_query)
        records = [r[0] for r in att_res.all()]
        
        present_count = 0
        avg_attendance_str = "0.0%"
        if records:
            present_count = sum(1 for status in records if status in (AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.HALF_DAY))
            avg_attendance_str = f"{(present_count / len(records)) * 100:.1f}%"
        else:
            avg_attendance_str = "0.0%"
            
        # 5. Student Enrollment Chart (last 12 months)
        enrollment_data = []
        months_abbrev = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        
        # Generate the last 12 months (inclusive of current month)
        # Sort so they appear chronological from oldest to newest (index 11 down to 0)
        for i in range(11, -1, -1):
            m_date = today - timedelta(days=i*30)
            month_label = months_abbrev[m_date.month - 1]
            
            # Start of next month
            if m_date.month == 12:
                next_month_start = date(m_date.year + 1, 1, 1)
            else:
                next_month_start = date(m_date.year, m_date.month + 1, 1)
            
            count_query = select(func.count(Student.id)).where(
                Student.created_at < next_month_start,
                Student.is_deleted.is_(False)
            )
            count_val = (await db.execute(count_query)).scalar() or 0
            enrollment_data.append({"month": month_label, "count": count_val})
            
        # 6. Today's Attendance Distribution
        present_today = sum(1 for status in records if status == AttendanceStatus.PRESENT)
        absent_today = sum(1 for status in records if status == AttendanceStatus.ABSENT)
        late_today = sum(1 for status in records if status == AttendanceStatus.LATE)
        
        attendance_data = [
            {"name": "Present", "value": present_today, "color": "#16a34a"},
            {"name": "Absent", "value": absent_today, "color": "#dc2626"},
            {"name": "Late", "value": late_today, "color": "#d97706"}
        ]
        
        # 7. Fee Collection vs Pending by Month (last 6 months)
        fee_data = []
        for i in range(5, -1, -1):
            m_date = today - timedelta(days=i*30)
            month_label = months_abbrev[m_date.month - 1]
            
            # Start and end of that month
            m_start = date(m_date.year, m_date.month, 1)
            if m_date.month == 12:
                m_end = date(m_date.year + 1, 1, 1) - timedelta(days=1)
            else:
                m_end = date(m_date.year, m_date.month + 1, 1) - timedelta(days=1)
                
            collected_query = select(func.sum(FeePayment.amount_paid)).where(
                FeePayment.payment_date >= m_start,
                FeePayment.payment_date <= m_end,
                FeePayment.is_deleted.is_(False)
            )
            collected_val = (await db.execute(collected_query)).scalar() or 0.0
            collected_lakhs = round(float(collected_val) / 100000.0, 2)
            
            pending_lakhs = 0.0
            if total_students > 0:
                mandatory_query = select(func.sum(FeeStructure.amount)).where(
                    FeeStructure.is_mandatory.is_(True),
                    FeeStructure.is_deleted.is_(False)
                )
                mandatory_sum = (await db.execute(mandatory_query)).scalar() or 0.0
                total_expected_month = (total_students * float(mandatory_sum)) / 12.0
                pending_val = max(0.0, total_expected_month - float(collected_val))
                pending_lakhs = round(pending_val / 100000.0, 2)
                
            fee_data.append({
                "month": month_label,
                "collected": collected_lakhs,
                "pending": pending_lakhs
            })
            
        # 8. Recent Activities
        recent_query = select(AuditLog, User).join(
            User, User.id == AuditLog.user_id, isouter=True
        ).order_by(AuditLog.created_at.desc()).limit(4)
        recent_res = await db.execute(recent_query)
        activities = []
        for log, u in recent_res.all():
            username = f"{u.first_name} {u.last_name}" if u else "System"
            activities.append({
                "text": f"{username}: {log.action}",
                "time": log.created_at.strftime("%I:%M %p")
            })
            
        if not activities:
            activities = [
                {"text": "No recent operations logged.", "time": "Just now"}
            ]
            
        return success_response(data={
            "role": role,
            "total_students": total_students,
            "total_teachers": total_teachers,
            "fee_collected": fee_collected_str,
            "avg_attendance": avg_attendance_str,
            "enrollment_data": enrollment_data,
            "attendance_data": attendance_data,
            "fee_data": fee_data,
            "activities": activities,
            "subtext_attendance": f"{present_count} present"
        })
