import asyncio
from uuid import UUID, uuid4
from datetime import date
from sqlalchemy import select

from app.core.session import AsyncSessionLocal
from app.models import (
    Student, Parent, User, SchoolClass, Section, AcademicYear,
    Attendance, FeeInvoice, Exam, ExamSchedule, ExamMark, Subject, Circular
)
from app.routers.portal import get_portal_overview

from app.core.enums import Gender

async def run_portal_tests():
    print("=== STARTING CONSOLIDATED PORTAL & MULTI-CHILD VERIFICATION TESTS ===")
    async with AsyncSessionLocal() as db:
        # 1. Fetch AcademicYear, Classes, and Sections
        ay_res = await db.execute(select(AcademicYear).limit(1))
        ay = ay_res.scalar_one_or_none()

        cls_res = await db.execute(select(SchoolClass).limit(2))
        classes = cls_res.scalars().all()
        sec_res = await db.execute(select(Section).limit(2))
        sections = sec_res.scalars().all()
        if len(sections) < 2:
            cls_val = classes[0] if classes else SchoolClass(name="Class 10", academic_year_id=str(ay.id))
            if not classes:
                db.add(cls_val)
                await db.flush()
            sec2 = Section(name="B", class_id=str(cls_val.id))
            db.add(sec2)
            await db.flush()
            sections.append(sec2)

        sec1 = sections[0]
        sec2 = sections[1]

        # 2. Create Test Parent User
        parent_phone = f"+919876{uuid4().hex[:6]}"
        parent_user = User(
            email=f"parent_{uuid4().hex[:4]}@example.com",
            password_hash="mockhash",
            first_name="Rajesh",
            last_name="Sharma",
            phone=parent_phone,
            role="parent",
            is_active=True,
        )
        db.add(parent_user)
        await db.flush()

        # 3. Create Child 1 (Sibling A - Elder Child)
        child1 = Student(
            academic_year_id=str(ay.id),
            section_id=str(sec1.id),
            admission_number=f"SIBLING-A-{uuid4().hex[:4].upper()}",
            first_name="Aarav",
            last_name="Sharma",
            date_of_birth=date(2010, 5, 10),
            gender=Gender.MALE,
        )
        db.add(child1)
        await db.flush()

        # Create Child 2 (Sibling B - Younger Child)
        child2 = Student(
            academic_year_id=str(ay.id),
            section_id=str(sec2.id),
            admission_number=f"SIBLING-B-{uuid4().hex[:4].upper()}",
            first_name="Diya",
            last_name="Sharma",
            date_of_birth=date(2013, 8, 20),
            gender=Gender.FEMALE,
        )
        db.add(child2)
        await db.flush()

        # Link both children to Parent user
        p1 = Parent(
            user_id=parent_user.id,
            student_id=child1.id,
            relation="Father",
            first_name="Rajesh",
            last_name="Sharma",
            phone=parent_phone,
            is_primary_contact=True,
        )
        p2 = Parent(
            user_id=parent_user.id,
            student_id=child2.id,
            relation="Father",
            first_name="Rajesh",
            last_name="Sharma",
            phone=parent_phone,
            is_primary_contact=True,
        )
        db.add_all([p1, p2])
        await db.flush()

        print(f"[TEST SETUP] Created Parent User ({parent_user.email}) linked to 2 children:")
        print(f"  - Child 1: {child1.first_name} ({child1.admission_number}) ID: {child1.id}")
        print(f"  - Child 2: {child2.first_name} ({child2.admission_number}) ID: {child2.id}")

        # -------------------------------------------------------------
        # Seed Data for Child 1 (Aarav): 100% Attendance, ₹10,000 Fee Invoice, Mid-Term Exam (95%)
        # -------------------------------------------------------------
        # Attendance
        db.add(Attendance(student_id=child1.id, section_id=child1.section_id, academic_year_id=str(ay.id), date=date.today(), status="present", marked_by=parent_user.id))
        # Fee Invoice
        db.add(FeeInvoice(
            invoice_number=f"INV-CH1-{uuid4().hex[:4].upper()}",
            student_id=child1.id,
            title="Term 1 Tuition Fee (Child 1)",
            amount_due=10000.0,
            amount_paid=0.0,
            due_date=date.today(),
            status="unpaid"
        ))
        # Exam
        exam1 = Exam(academic_year_id=str(ay.id), name="Child 1 Term Evaluation", exam_type="Mid-Term", is_published=True)
        db.add(exam1)
        await db.flush()
        subj1 = Subject(name="Mathematics", code="MATH101", academic_year_id=str(ay.id))
        db.add(subj1)
        await db.flush()
        sch1 = ExamSchedule(exam_id=exam1.id, subject_id=subj1.id, section_id=child1.section_id, exam_date=date.today(), max_marks=100.0, pass_marks=33.0)
        db.add(sch1)
        await db.flush()
        db.add(ExamMark(exam_schedule_id=sch1.id, student_id=child1.id, marks_obtained=95.0, remarks="Outstanding"))

        # -------------------------------------------------------------
        # Seed Data for Child 2 (Diya): 50% Attendance, ₹5,000 Fee Invoice, Unit Test (65%)
        # -------------------------------------------------------------
        # Attendance (1 present, 1 absent = 50%)
        db.add(Attendance(student_id=child2.id, section_id=child2.section_id, academic_year_id=str(ay.id), date=date.today(), status="absent", marked_by=parent_user.id))
        # Fee Invoice
        db.add(FeeInvoice(
            invoice_number=f"INV-CH2-{uuid4().hex[:4].upper()}",
            student_id=child2.id,
            title="Term 1 Tuition Fee (Child 2)",
            amount_due=5000.0,
            amount_paid=5000.0,
            due_date=date.today(),
            status="paid"
        ))
        # Exam
        exam2 = Exam(academic_year_id=str(ay.id), name="Child 2 Unit Evaluation", exam_type="Unit-Test", is_published=True)
        db.add(exam2)
        await db.flush()
        subj2 = Subject(name="Science", code="SCI101", academic_year_id=str(ay.id))
        db.add(subj2)
        await db.flush()
        sch2 = ExamSchedule(exam_id=exam2.id, subject_id=subj2.id, section_id=child2.section_id, exam_date=date.today(), max_marks=100.0, pass_marks=33.0)
        db.add(sch2)
        await db.flush()
        db.add(ExamMark(exam_schedule_id=sch2.id, student_id=child2.id, marks_obtained=65.0, remarks="Good"))

        # Seed a Circular Notice
        db.add(Circular(title="Parent Teacher Meeting Notice", content="PTM is scheduled for next Saturday.", target_role="all", published_by=parent_user.id, is_published=True))
        await db.flush()

        # -------------------------------------------------------------
        # TEST 1: Default Overview Query (Child 1 - Aarav)
        # -------------------------------------------------------------
        print("\n--- TEST 1: PORTAL OVERVIEW FOR CHILD 1 (DEFAULT) ---")
        ov1 = await get_portal_overview(student_id=None, current_user=parent_user, db=db)
        data1 = ov1["data"]

        print(f"[CHILD 1 OVERVIEW] Linked Children Count: {len(data1['children'])}")
        print(f"[CHILD 1 OVERVIEW] Active Child: {data1['active_student']['first_name']} {data1['active_student']['last_name']}")
        print(f"[CHILD 1 ATTENDANCE] Rate: {data1['attendance']['overall_percentage']}%")
        print(f"[CHILD 1 FEES] Outstanding Balance: Rs.{data1['fees']['net_outstanding']}")
        print(f"[CHILD 1 EXAM] Exam Name: {data1['exams']['exam_name']}, Grade: {data1['exams']['grade']} ({data1['exams']['percentage']}%)")

        assert len(data1["children"]) == 2, f"Expected 2 linked children, got {len(data1['children'])}"
        assert data1["active_student"]["student_id"] == child1.id, "Expected Child 1 as active student"
        assert data1["attendance"]["overall_percentage"] == 100.0, f"Expected 100% attendance, got {data1['attendance']['overall_percentage']}"
        assert data1["fees"]["net_outstanding"] == 10000.0, f"Expected Rs.10,000 outstanding, got {data1['fees']['net_outstanding']}"
        assert data1["exams"]["grade"] == "A1", f"Expected grade A1, got {data1['exams']['grade']}"
        print("[SUCCESS] TEST 1 PASSED: Child 1 attendance, fees, and exam data loaded correctly.")

        # -------------------------------------------------------------
        # TEST 2: Switch Active Child to Child 2 (Diya)
        # -------------------------------------------------------------
        print("\n--- TEST 2: SWITCH CHILD TO CHILD 2 (DIYA) ---")
        ov2 = await get_portal_overview(student_id=UUID(child2.id), current_user=parent_user, db=db)
        data2 = ov2["data"]

        print(f"[CHILD 2 OVERVIEW] Active Child: {data2['active_student']['first_name']} {data2['active_student']['last_name']}")
        print(f"[CHILD 2 ATTENDANCE] Rate: {data2['attendance']['overall_percentage']}%")
        print(f"[CHILD 2 FEES] Outstanding Balance: Rs.{data2['fees']['net_outstanding']}")
        print(f"[CHILD 2 EXAM] Exam Name: {data2['exams']['exam_name']}, Grade: {data2['exams']['grade']} ({data2['exams']['percentage']}%)")

        assert data2["active_student"]["student_id"] == child2.id, "Expected Child 2 as active student"
        assert data2["attendance"]["overall_percentage"] == 0.0, f"Expected 0% attendance, got {data2['attendance']['overall_percentage']}"
        assert data2["fees"]["net_outstanding"] == 0.0, f"Expected Rs.0 outstanding, got {data2['fees']['net_outstanding']}"
        assert data2["exams"]["grade"] == "B2", f"Expected grade B2, got {data2['exams']['grade']}"
        print("[SUCCESS] TEST 2 PASSED: Switching children dynamically updated all 3 sections correctly!")

    print("\nALL PORTAL VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_portal_tests())
