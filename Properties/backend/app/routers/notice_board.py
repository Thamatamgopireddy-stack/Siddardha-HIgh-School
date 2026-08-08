from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response, get_current_user
from app.core.session import get_db
from app.models import Circular, User

router = APIRouter(prefix="/notice-board", tags=["notice-board"])


class NoticeCreate(BaseModel):
    title: str
    content: str
    target_role: str = "all"


@router.get("/")
async def list_notices(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Retrieve notices targetted for the current user's role or 'all'
    query = (
        select(Circular, User)
        .join(User, User.id == Circular.published_by)
        .where(
            Circular.is_published.is_(True),
            Circular.is_deleted.is_(False),
        )
    )
    # Non-admins only see notices targeting their role or 'all'
    if current_user.role.value not in ("super_admin", "developer", "school_admin", "principal"):
        query = query.where(Circular.target_role.in_([current_user.role.value, "all"]))

    result = await db.execute(query)
    notices = []
    for circular, user in result.all():
        notices.append(
            {
                "id": circular.id,
                "title": circular.title,
                "content": circular.content,
                "target_role": circular.target_role,
                "published_by_name": f"{user.first_name} {user.last_name}",
                "published_at": circular.published_at.isoformat() if circular.published_at else None,
            }
        )
    return success_response(data=notices)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_notice(
    body: NoticeCreate,
    current_user: User = Depends(require_permission("students:edit")),
    db: AsyncSession = Depends(get_db),
):
    notice = Circular(
        title=body.title,
        content=body.content,
        target_role=body.target_role,
        published_by=current_user.id,
        is_published=False,
    )
    db.add(notice)
    await db.commit()
    return success_response(
        data={
            "id": notice.id,
            "title": notice.title,
            "content": notice.content,
            "target_role": notice.target_role,
            "is_published": notice.is_published,
        },
        message="Notice draft created successfully",
    )


@router.post("/{notice_id}/publish")
async def publish_notice(
    notice_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:edit")),
):
    result = await db.execute(
        select(Circular).where(
            Circular.id == str(notice_id),
            Circular.is_deleted.is_(False),
        )
    )
    notice = result.scalar_one_or_none()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")

    notice.is_published = True
    notice.published_at = datetime.now(timezone.utc)
    await db.commit()

    # Broadcast notice in real-time over WebSocket
    try:
        from app.services.websocket import ws_manager
        ws_packet = {
            "type": "new_notice",
            "data": {
                "id": str(notice.id),
                "title": notice.title,
                "content": notice.content,
                "target_role": notice.target_role,
            }
        }
        if notice.target_role and notice.target_role != "all":
            await ws_manager.broadcast_to_role(ws_packet, notice.target_role)
        else:
            await ws_manager.broadcast_to_all(ws_packet)
    except Exception:
        pass

    return success_response(message="Notice published successfully to the Notice Board")
