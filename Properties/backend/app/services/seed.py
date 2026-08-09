import logging
from datetime import date, datetime, timezone
from uuid import uuid4
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import UserRole, Gender, Category, AttendanceStatus
from app.core.security import hash_password
from app.models import (
    AcademicYear, Permission, RolePermission, SchoolClass, Section, User,
    Student, Staff, FeeStructure, FeePayment, Exam, ExamSchedule, ExamMark,
    Attendance, Book, BookIssue, TransportRoute, Vehicle, Hostel, HostelRoom, Circular, Subject
)
from app.services.auth_service import DEFAULT_PERMISSIONS, ROLE_PERMISSION_MAP

logger = logging.getLogger("siddardha.seed")


async def seed_database(db: AsyncSession) -> None:
    # 1. Seed Permissions & Role Permissions
    existing_perms = await db.execute(select(Permission))
    perms_in_db = existing_perms.scalars().all()
    if not perms_in_db:
        perm_map: dict[str, Permission] = {}
        for name, desc in DEFAULT_PERMISSIONS:
            perm = Permission(name=name, description=desc)
            db.add(perm)
            perm_map[name] = perm
        await db.flush()
        
        for role, perm_names in ROLE_PERMISSION_MAP.items():
            for perm_name in perm_names:
                if perm_name in perm_map:
                    db.add(RolePermission(role=role, permission_id=perm_map[perm_name].id))
        
        for perm in perm_map.values():
            db.add(RolePermission(role=UserRole.SCHOOL_ADMIN, permission_id=perm.id))
        await db.flush()

    # 2. Seed Default System Users
    users_data = [
        ("admin@school.edu", "9999999999", "Admin@12345", "System", "Admin", UserRole.SCHOOL_ADMIN),
        ("cashier@school.edu", "9999999998", "Cashier@12345", "Ramesh", "Kumar", UserRole.ACCOUNTANT),
        ("admission@school.edu", "9999999997", "Admission@12345", "Seema", "Reddy", UserRole.SCHOOL_ADMIN),
        ("teacher@school.edu", "9999999996", "Teacher@12345", "Priya", "Nair", UserRole.TEACHER),
        ("principal@school.edu", "9999999995", "Principal@12345", "Dr. V. K.", "Rao", UserRole.PRINCIPAL),
    ]

    for email, phone, pwd, fname, lname, role in users_data:
        res = await db.execute(select(User).where(User.email == email))
        if not res.scalar_one_or_none():
            db.add(User(
                email=email,
                phone=phone,
                password_hash=hash_password(pwd),
                first_name=fname,
                last_name=lname,
                role=role,
                is_active=True,
                is_email_verified=True,
            ))
    await db.flush()

    # 3. Seed Academic Configuration (Academic Year, Classes, Sections)
    existing_year = await db.execute(select(AcademicYear).where(AcademicYear.name == "2025-26"))
    year = existing_year.scalar_one_or_none()
    if not year:
        year = AcademicYear(
            name="2025-26",
            start_date=date(2025, 4, 1),
            end_date=date(2026, 3, 31),
            is_current=True,
        )
        db.add(year)
        await db.flush()

    classes_to_seed = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"]
    sections_to_seed = ["A", "B", "G"]
    sec_map: dict[str, Section] = {}

    for cls_name in classes_to_seed:
        existing_cls = await db.execute(select(SchoolClass).where(SchoolClass.name == cls_name, SchoolClass.academic_year_id == year.id))
        cls = existing_cls.scalar_one_or_none()
        if not cls:
            cls = SchoolClass(name=cls_name, academic_year_id=year.id)
            db.add(cls)
            await db.flush()

        for sec_name in sections_to_seed:
            existing_sec = await db.execute(select(Section).where(Section.class_id == cls.id, Section.name == sec_name))
            sec = existing_sec.scalar_one_or_none()
            if not sec:
                sec = Section(class_id=cls.id, name=sec_name)
                db.add(sec)
                await db.flush()
            sec_map[f"{cls_name}-{sec_name}"] = sec

    # 4. Seed Subjects
    subjects_data = ["Mathematics", "Science", "English", "Social Studies", "Telugu", "Computer Science"]
    subject_map: dict[str, Subject] = {}
    for sub_name in subjects_data:
        res = await db.execute(select(Subject).where(Subject.name == sub_name))
        sub = res.scalar_one_or_none()
        if not sub:
            sub = Subject(name=sub_name, code=sub_name[:3].upper(), academic_year_id=year.id)
            db.add(sub)
            await db.flush()
        subject_map[sub_name] = sub

    # 5. Staff Directory
    staff_count = (await db.execute(select(func.count(Staff.id)))).scalar() or 0
    if staff_count == 0:
        logger.info("Seeding faculty and staff directory...")
        teacher_res = await db.execute(select(User).where(User.email == "teacher@school.edu"))
        teacher_user = teacher_res.scalar_one_or_none()
        if teacher_user:
            db.add(Staff(
                user_id=teacher_user.id,
                employee_id="EMP202501",
                department="Mathematics",
                is_active=True
            ))
        await db.flush()

    # 6. Seed Fee Structures
    fee_struct_count = (await db.execute(select(func.count(FeeStructure.id)))).scalar() or 0
    if fee_struct_count == 0:
        logger.info("Seeding fee structures...")
        fee_tuition = FeeStructure(
            academic_year_id=year.id,
            name="Tuition Fee Term 1",
            amount=15000.0,
            frequency="Term",
            is_mandatory=True
        )
        fee_trans = FeeStructure(
            academic_year_id=year.id,
            name="Annual Bus Transport Fee",
            amount=8000.0,
            frequency="Annual",
            is_mandatory=False
        )
        db.add(fee_tuition)
        db.add(fee_trans)
        await db.flush()

    # 9. Seed Examinations & Schedules
    exam_count = (await db.execute(select(func.count(Exam.id)))).scalar() or 0
    if exam_count == 0:
        logger.info("Seeding examinations...")
        mid_exam = Exam(
            academic_year_id=year.id,
            name="Half-Yearly Examination 2025",
            exam_type="Term",
            is_published=True
        )
        db.add(mid_exam)
        await db.flush()

    # 10. Seed Ancillary Modules (Library, Transport, Hostel)
    book_count = (await db.execute(select(func.count(Book.id)))).scalar() or 0
    if book_count == 0:
        logger.info("Seeding library books catalog...")
        sample_books = [
            ("NCERT Mathematics Class 10", "NCERT", "ISBN9788174506344", 50, 45),
            ("NCERT Science Class 10", "NCERT", "ISBN9788174506450", 50, 42),
            ("Concepts of Physics", "H. C. Verma", "ISBN9788177091877", 20, 18),
            ("High School English Grammar", "Wren & Martin", "ISBN9789352530144", 30, 25),
        ]
        for title, author, isbn, qty, avail in sample_books:
            db.add(Book(
                title=title, author=author, isbn=isbn,
                quantity=qty, available_quantity=avail
            ))
        await db.flush()

    # 11. Seed Notice Board Announcements & Circulars
    circ_count = (await db.execute(select(func.count(Circular.id)))).scalar() or 0
    if circ_count == 0:
        logger.info("Seeding notice board announcements...")
        admin_user = (await db.execute(select(User).where(User.email == "admin@school.edu"))).scalar_one_or_none()
        admin_id = admin_user.id if admin_user else None

        db.add(Circular(
            title="Annual Sports Day Meet 2025",
            content="Siddardha High School will hold its Annual Sports Day on November 15th. All students must assemble in proper house uniforms.",
            target_role="all",
            published_by=admin_id,
            is_published=True,
            published_at=datetime.now(timezone.utc)
        ))
        db.add(Circular(
            title="Term 1 Examination Schedule Published",
            content="The timetable for Term 1 Mid-Term examinations has been published on the student dashboard.",
            target_role="all",
            published_by=admin_id,
            is_published=True,
            published_at=datetime.now(timezone.utc)
        ))
        await db.flush()

    # 12. Ensure all active students have valid academic_year_id and section_id
    from sqlalchemy import or_
    default_sec = (await db.execute(select(Section).where(Section.is_deleted.is_(False)))).scalars().first()
    default_sec_id = default_sec.id if default_sec else None

    unlinked_students = (await db.execute(
        select(Student).where(
            Student.is_deleted.is_(False),
            or_(
                Student.academic_year_id.is_(None),
                Student.academic_year_id == "",
                Student.section_id.is_(None),
                Student.section_id == ""
            )
        )
    )).scalars().all()

    if unlinked_students:
        logger.info(f"Auto-linking {len(unlinked_students)} unassigned student records to current academic year and default section...")
        for st in unlinked_students:
            if not st.academic_year_id:
                st.academic_year_id = str(year.id)
            if not st.section_id and default_sec_id:
                st.section_id = str(default_sec_id)
        await db.flush()

    await db.commit()
    logger.info("Database seeding complete with full relational data!")
