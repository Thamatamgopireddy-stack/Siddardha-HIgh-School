from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import UserRole
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.models import PasswordHistory, Permission, RolePermission, User
from app.schemas.common import UserBrief


DEFAULT_PERMISSIONS = [
    ("students:view", "View students"),
    ("students:create", "Create students"),
    ("students:edit", "Edit students"),
    ("students:delete", "Delete students"),
    ("students:export", "Export students"),
    ("students:promote", "Promote students"),
    ("students:admin", "Admin student portal"),
    ("admissions:view", "View admissions"),
    ("admissions:create", "Create admissions"),
    ("admissions:edit", "Edit admissions"),
    ("attendance:view", "View attendance"),
    ("attendance:mark", "Mark attendance"),
    ("fees:view", "View fees"),
    ("fees:collect", "Collect fees"),
    ("exams:view", "View exams"),
    ("exams:manage", "Manage exams"),
    ("ancillary:view", "View ancillary modules"),
    ("ancillary:manage", "Manage ancillary modules"),
    ("teachers:view", "View teachers"),
    ("teachers:manage", "Manage teachers"),
    ("timetable:view", "View timetable"),
    ("timetable:manage", "Manage timetable"),
    ("payroll:view", "View payroll"),
    ("payroll:manage", "Manage payroll"),
    ("hr:view", "View HR"),
    ("hr:manage", "Manage HR"),
    ("reports:view", "View reports"),
    ("settings:view", "View settings"),
    ("developer:access", "Developer panel access"),
]

ROLE_PERMISSION_MAP: dict[UserRole, list[str]] = {
    UserRole.SCHOOL_ADMIN: [p[0] for p in DEFAULT_PERMISSIONS if p[0] != "developer:access"],
    UserRole.PRINCIPAL: [
        "students:view", "attendance:view", "fees:view", "exams:view", "reports:view",
    ],
    UserRole.TEACHER: ["students:view", "attendance:view", "attendance:mark", "exams:view"],
    UserRole.CLASS_TEACHER: [
        "students:view", "students:edit", "attendance:view", "attendance:mark", "exams:view",
    ],
    UserRole.ACCOUNTANT: ["students:view", "fees:view", "fees:collect", "reports:view"],
    UserRole.STUDENT: ["students:view", "attendance:view", "exams:view", "fees:view"],
    UserRole.PARENT: ["students:view", "attendance:view", "exams:view", "fees:view"],
}


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def authenticate(self, email_or_phone: str, password: str) -> tuple[User, str, str]:
        if not (email_or_phone.endswith("@gmail.com") or email_or_phone.endswith("@school.edu")):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication is restricted to Gmail accounts (@gmail.com) only",
            )
        result = await self.db.execute(
            select(User).where(
                or_(User.email == email_or_phone, User.phone == email_or_phone),
                User.is_deleted.is_(False),
            )
        )
        user = result.scalar_one_or_none()
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        user.last_login_at = datetime.now(timezone.utc)
        await self.db.flush()

        access = create_access_token(str(user.id), {"role": user.role.value})
        refresh = create_refresh_token(str(user.id))
        return user, access, refresh

    async def refresh_access_token(self, refresh_token: str) -> tuple[str, str]:
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
            user_id = payload.get("sub")
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

        result = await self.db.execute(select(User).where(User.id == user_id, User.is_deleted.is_(False)))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        return create_access_token(str(user.id), {"role": user.role.value}), create_refresh_token(str(user.id))

    async def change_password(self, user: User, current: str, new_password: str) -> None:
        if not verify_password(current, user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
        if not validate_password_strength(new_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be 8+ chars with upper, lower, digit, and special character",
            )

        history = await self.db.execute(
            select(PasswordHistory)
            .where(PasswordHistory.user_id == user.id)
            .order_by(PasswordHistory.created_at.desc())
            .limit(5)
        )
        for record in history.scalars().all():
            if verify_password(new_password, record.password_hash):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot reuse recent passwords")

        self.db.add(PasswordHistory(user_id=user.id, password_hash=user.password_hash))
        user.password_hash = hash_password(new_password)
        user.force_password_change = False
        await self.db.flush()

    async def get_user_permissions(self, user: User) -> list[str]:
        if user.role in (UserRole.SUPER_ADMIN, UserRole.DEVELOPER, UserRole.SCHOOL_ADMIN):
            result = await self.db.execute(select(Permission.name))
            return [row[0] for row in result.all()]
        result = await self.db.execute(
            select(Permission.name)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role == user.role)
        )
        return [row[0] for row in result.all()]

    @staticmethod
    def to_user_brief(user: User) -> UserBrief:
        return UserBrief(
            id=UUID(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role.value,
            profile_photo_url=user.profile_photo_url,
            force_password_change=user.force_password_change,
        )
