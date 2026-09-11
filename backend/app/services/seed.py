from datetime import date
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import UserRole
from app.core.security import hash_password
from app.models import AcademicYear, Permission, RolePermission, SchoolClass, Section, User, Student
from app.services.auth_service import DEFAULT_PERMISSIONS, ROLE_PERMISSION_MAP


async def seed_database(db: AsyncSession) -> None:
    # 1. Seed Permissions and Admin User
    existing_admin = await db.execute(select(User).where(User.email == "admin@school.edu"))
    admin = existing_admin.scalar_one_or_none()
    
    if not admin:
        perm_map: dict[str, Permission] = {}
        for name, desc in DEFAULT_PERMISSIONS:
            perm = Permission(name=name, description=desc)
            db.add(perm)
            perm_map[name] = perm
        await db.flush()

        admin = User(
            email="admin@school.edu",
            phone="9999999999",
            password_hash=hash_password("Admin@12345"),
            first_name="System",
            last_name="Admin",
            role=UserRole.SCHOOL_ADMIN,
            is_active=True,
            is_email_verified=True,
            force_password_change=True,
        )
        db.add(admin)
        await db.flush()

        for role, perm_names in ROLE_PERMISSION_MAP.items():
            for perm_name in perm_names:
                if perm_name in perm_map:
                    db.add(RolePermission(role=role, permission_id=perm_map[perm_name].id))

        for perm in perm_map.values():
            db.add(RolePermission(role=UserRole.SCHOOL_ADMIN, permission_id=perm.id))
        await db.flush()

    # 2. Ensure Current Academic Year exists
    year_res = await db.execute(select(AcademicYear).where(AcademicYear.name == "2025-26", AcademicYear.is_deleted.is_(False)))
    year = year_res.scalar_one_or_none()
    if not year:
        year = AcademicYear(
            name="2025-26",
            start_date=date(2025, 4, 1),
            end_date=date(2026, 3, 31),
            is_current=True,
        )
        db.add(year)
        await db.flush()
    else:
        year.is_current = True
        await db.flush()

    # 3. Ensure Classes 6th through 10th exist with Sections A, B, G (Girls), and S
    standard_classes = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"]
    standard_sections = ["A", "B", "G", "S"]

    class_sec_map: dict[str, list[Section]] = {}

    for cls_name in standard_classes:
        c_res = await db.execute(
            select(SchoolClass).where(
                SchoolClass.name == cls_name,
                SchoolClass.academic_year_id == year.id,
                SchoolClass.is_deleted.is_(False)
            )
        )
        cls_obj = c_res.scalar_one_or_none()
        if not cls_obj:
            cls_obj = SchoolClass(name=cls_name, academic_year_id=year.id)
            db.add(cls_obj)
            await db.flush()

        class_sec_map[cls_name] = []
        for sec_name in standard_sections:
            s_res = await db.execute(
                select(Section).where(
                    Section.class_id == cls_obj.id,
                    Section.name == sec_name,
                    Section.is_deleted.is_(False)
                )
            )
            sec_obj = s_res.scalar_one_or_none()
            if not sec_obj:
                sec_obj = Section(class_id=cls_obj.id, name=sec_name)
                db.add(sec_obj)
                await db.flush()
            class_sec_map[cls_name].append(sec_obj)

    # 4. Auto-link unassigned students or students without section
    # Fetch all active sections for Year
    all_sections_res = await db.execute(
        select(Section).join(SchoolClass, Section.class_id == SchoolClass.id)
        .where(SchoolClass.academic_year_id == year.id, Section.is_deleted.is_(False))
    )
    all_active_sections = all_sections_res.scalars().all()

    if all_active_sections:
        # Find students with no section_id or unassigned section
        unassigned_res = await db.execute(
            select(Student).where(
                (Student.section_id.is_(None)) | (Student.section_id == ""),
                Student.is_deleted.is_(False)
            )
        )
        unassigned_students = unassigned_res.scalars().all()
        
        if unassigned_students:
            for idx, student in enumerate(unassigned_students):
                # Distribute across available sections or assign to Class 6 / 7 / 8 / 9 / 10 Sections
                sec = all_active_sections[idx % len(all_active_sections)]
                student.section_id = sec.id
                student.academic_year_id = year.id
            await db.flush()

    await db.commit()
