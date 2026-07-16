from typing import TypeVar
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import UserRole
from app.core.security import decode_token
from app.core.session import get_db
from app.models import Permission, RolePermission, User
from app.schemas.common import APIResponse

ModelType = TypeVar("ModelType")

_role_permissions: dict[str, set[str]] = {}


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(authorization[7:])
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user_id = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    result = await db.execute(select(User).where(User.id == user_id, User.is_deleted.is_(False)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")
    return user


async def load_role_permissions(db: AsyncSession) -> None:
    global _role_permissions
    result = await db.execute(
        select(RolePermission.role, Permission.name).join(
            Permission, Permission.id == RolePermission.permission_id
        )
    )
    mapping: dict[str, set[str]] = {}
    for role, perm_name in result.all():
        mapping.setdefault(role.value, set()).add(perm_name)
    _role_permissions = mapping


def has_permission(role: UserRole, permission: str) -> bool:
    if role in (UserRole.SUPER_ADMIN, UserRole.DEVELOPER):
        return True
    return permission in _role_permissions.get(role.value, set())


def require_permission(permission: str):
    async def checker(user: User = Depends(get_current_user)) -> User:
        if not has_permission(user.role, permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return checker


def success_response(data=None, message: str = "Operation successful", meta=None) -> dict:
    return APIResponse(data=data, message=message, meta=meta).model_dump()
