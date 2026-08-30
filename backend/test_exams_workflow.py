import asyncio
from uuid import UUID, uuid4
from datetime import date
from sqlalchemy import select

from app.core.session import AsyncSessionLocal
from app.models import Exam, ExamSchedule, ExamMark, Student, Subject, Section, SchoolClass, AcademicYear
from app.routers.exams import (
    create_exam, create_exam_schedule, save_schedule_marks, publish_exam,
    get_student_exam_result, download_student_report_card,
    ExamCreate, ExamScheduleCreate, ExamMarksBulk, ExamMarkSave, ExamPublishToggle,
    calculate_cbse_grade
)

class MockUser:
    id = str(uuid4())
    first_name = "Admin"
    last_name = "User"
    role = "school_admin"
    permissions = ["exams:manage", "exams:view"]

async def run_exam_tests():
    print("=== STARTING EXAMS & REPORT CARD VERIFICATION TESTS ===")
    async with AsyncSessionLocal() as db:
        # 1. Fetch prerequisite AcademicYear, Section, and Subjects
        ay_res = await db.execute(select(AcademicYear).limit(1))
        ay = ay_res.scalar_one_or_none()
        if not ay:
            print("[ERROR] No academic year found!")
            return

        sec_res = await db.execute(select(Section).limit(1))
        sec = sec_res.scalar_one_or_none()
        if not sec:
            print("[ERROR] No section found!")
            return

        # Fetch 3 subjects or create test subjects if needed
        subj_res = await db.execute(select(Subject).limit(3))
        subjects = subj_res.scalars().all()
        while len(subjects) < 3:
            s_name = f"Subject {len(subjects) + 1}"
            s_code = f"SUB{len(subjects) + 1}"
            new_s = Subject(name=s_name, code=s_code, academic_year_id=str(ay.id))
            db.add(new_s)
            await db.flush()
            subjects.append(new_s)

        print(f"[TEST SETUP] Academic Year: {ay.name}, Section: {sec.name}, Subjects: {[s.name for s in subjects]}")

        # Fetch or create 3 test students in section
        st_res = await db.execute(select(Student).where(Student.section_id == sec.id, Student.is_deleted.is_(False)).limit(3))
        students = st_res.scalars().all()
        while len(students) < 3:
            s_idx = len(students) + 1
            st_new = Student(
                academic_year_id=str(ay.id),
                section_id=str(sec.id),
                admission_number=f"EXAMSTU-{uuid4().hex[:4].upper()}",
                first_name=f"ExamStudent{s_idx}",
                last_name="Test",
                date_of_birth=date(2010, 1, 1),
                gender="Male",
            )
            db.add(st_new)
            await db.flush()
            students.append(st_new)

        print(f"[TEST SETUP] Target Students: {[f'{s.first_name} ({s.admission_number})' for s in students]}")

        # -------------------------------------------------------------
        # 1. Create a Test Exam
        # -------------------------------------------------------------
        exam_body = ExamCreate(
            academic_year_id=UUID(ay.id),
            name=f"Mid-Term Exam {uuid4().hex[:4].upper()}",
            exam_type="Mid-Term"
        )
        exam_res = await create_exam(body=exam_body, _=MockUser(), db=db)
        exam_id = UUID(exam_res["data"]["id"])
        print(f"[EXAM TEST] Created Exam: {exam_res['data']['name']} (ID: {exam_id})")

        # -------------------------------------------------------------
        # 2. Schedule 3 Subjects with max_marks = 100
        # -------------------------------------------------------------
        schedules = []
        for subj in subjects:
            sch_body = ExamScheduleCreate(
                subject_id=UUID(subj.id),
                section_id=UUID(sec.id),
                exam_date=date.today(),
                max_marks=100.0,
                pass_marks=33.0
            )
            sch_res = await create_exam_schedule(exam_id=exam_id, body=sch_body, _=MockUser(), db=db)
            schedules.append(sch_res["data"]["id"])
        print(f"[EXAM TEST] Scheduled 3 subjects. Schedule IDs: {schedules}")

        # -------------------------------------------------------------
        # 3. Enter Marks for 3 Students across 3 Subjects
        # -------------------------------------------------------------
        # Target test profiles:
        # Student 0: Math=95, Science=90, English=88 (Total: 273/300, 91.0%, Grade: A1)
        # Student 1: Math=75, Science=80, English=70 (Total: 225/300, 75.0%, Grade: B1)
        # Student 2: Math=25, Science=30, English=28 (Total: 83/300, 27.67%, Grade: E)
        marks_matrix = [
            [95.0, 90.0, 88.0],
            [75.0, 80.0, 70.0],
            [25.0, 30.0, 28.0]
        ]

        for s_idx, sch_id in enumerate(schedules):
            records = []
            for st_idx, st in enumerate(students):
                m_val = marks_matrix[st_idx][s_idx]
                records.append(ExamMarkSave(
                    student_id=UUID(st.id),
                    marks_obtained=m_val,
                    remarks="Excellent" if m_val > 80 else "Keep it up"
                ))
            await save_schedule_marks(schedule_id=UUID(sch_id), body=ExamMarksBulk(records=records), _=MockUser(), db=db)

        print("[EXAM TEST] Entered marks for 3 students across 3 subjects successfully.")

        # -------------------------------------------------------------
        # 4. Publish Exam & Verify Calculated Percentage / CBSE Grade
        # -------------------------------------------------------------
        await publish_exam(exam_id=exam_id, body=ExamPublishToggle(is_published=True), _=MockUser(), db=db)

        # Check Student 0 result (Expected: 273/300 = 91.0% -> A1)
        st0_res = await get_student_exam_result(exam_id=exam_id, student_id=UUID(students[0].id), current_user=MockUser(), db=db)
        data0 = st0_res["data"]
        print(f"[RESULT CHECK] Student 1: Total = {data0['total_obtained']}/{data0['total_max']}, Percentage = {data0['percentage']}%, Grade = {data0['grade']}, Passed = {data0['is_passed']}")
        assert data0["total_obtained"] == 273.0, f"Expected total 273.0, got {data0['total_obtained']}"
        assert data0["percentage"] == 91.0, f"Expected 91.0%, got {data0['percentage']}%"
        assert data0["grade"] == "A1", f"Expected grade A1, got {data0['grade']}"

        # Check Student 2 result (Expected: 83/300 = 27.67% -> E, Failed)
        st2_res = await get_student_exam_result(exam_id=exam_id, student_id=UUID(students[2].id), current_user=MockUser(), db=db)
        data2 = st2_res["data"]
        print(f"[RESULT CHECK] Student 3: Total = {data2['total_obtained']}/{data2['total_max']}, Percentage = {data2['percentage']}%, Grade = {data2['grade']}, Passed = {data2['is_passed']}")
        assert data2["grade"] == "E", f"Expected grade E, got {data2['grade']}"
        assert data2["is_passed"] == False, "Expected student 3 is_passed to be False"

        print("[SUCCESS] Calculated percentages, totals, and CBSE grades verified perfectly.")

        # -------------------------------------------------------------
        # 5. Download Student Report Card PDF
        # -------------------------------------------------------------
        pdf_res = await download_student_report_card(exam_id=exam_id, student_id=UUID(students[0].id), current_user=MockUser(), db=db)
        content_type = pdf_res.headers.get("content-type") or pdf_res.media_type
        content_len = len(pdf_res.body)
        print(f"[PDF TEST] Report Card Response Type: {content_type}, Length: {content_len} bytes")
        assert content_len > 0, "Generated report card PDF response body is empty!"
        print("[SUCCESS] Printable Student Report Card generated successfully!")

    print("\nALL EXAMS & REPORT CARD VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_exam_tests())
