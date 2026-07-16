from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import UserRole
from app.core.security import hash_password
from app.models import AcademicYear, Permission, RolePermission, SchoolClass, Section, User
from app.services.auth_service import DEFAULT_PERMISSIONS, ROLE_PERMISSION_MAP


async def seed_database(db: AsyncSession) -> None:
    existing = await db.execute(select(User).where(User.email == "admin@school.edu"))
    if existing.scalar_one_or_none():
        return

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
    )
    db.add(admin)
    await db.flush()

    for role, perm_names in ROLE_PERMISSION_MAP.items():
        for perm_name in perm_names:
            if perm_name in perm_map:
                db.add(RolePermission(role=role, permission_id=perm_map[perm_name].id))

    for perm in perm_map.values():
        db.add(RolePermission(role=UserRole.SCHOOL_ADMIN, permission_id=perm.id))

    year = AcademicYear(
        name="2025-26",
        start_date=date(2025, 4, 1),
        end_date=date(2026, 3, 31),
        is_current=True,
    )
    db.add(year)
    await db.flush()

    cls = SchoolClass(name="Class 10", academic_year_id=year.id)
    db.add(cls)
    await db.flush()

    db.add(Section(class_id=cls.id, name="A"))
    await db.flush()
