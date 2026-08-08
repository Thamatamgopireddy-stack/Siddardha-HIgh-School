from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response, get_current_user
from app.core.session import get_db
from app.models import Circular, User

router = APIRouter(prefix="/circulars", tags=["circulars"])


class CircularCreate(BaseModel):
    title: str
    content: str
    target_role: str = "all"


@router.get("/")
async def list_circulars(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Circular, User)
        .join(User, User.id == Circular.published_by)
        .where(
            Circular.is_published.is_(True),
            Circular.is_deleted.is_(False),
        )
    )
    if current_user.role.value not in ("super_admin", "developer", "school_admin", "principal"):
        query = query.where(Circular.target_role.in_([current_user.role.value, "all"]))

    result = await db.execute(query)
    circulars = []
    for circular, user in result.all():
        circulars.append(
            {
                "id": circular.id,
                "title": circular.title,
                "content": circular.content,
                "target_role": circular.target_role,
                "published_by_name": f"{user.first_name} {user.last_name}",
                "published_at": circular.published_at.isoformat() if circular.published_at else None,
            }
        )
    return success_response(data=circulars)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_circular(
    body: CircularCreate,
    current_user: User = Depends(require_permission("students:edit")),
    db: AsyncSession = Depends(get_db),
):
    circular = Circular(
        title=body.title,
        content=body.content,
        target_role=body.target_role,
        published_by=current_user.id,
        is_published=True,
        published_at=datetime.now(timezone.utc),
    )
    db.add(circular)
    await db.commit()

    return success_response(
        data={
            "id": circular.id,
            "title": circular.title,
            "content": circular.content,
            "target_role": circular.target_role,
            "published_at": circular.published_at.isoformat() if circular.published_at else None,
        },
        message="Circular created and published successfully",
    )
