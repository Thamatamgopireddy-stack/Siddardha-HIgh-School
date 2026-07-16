from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission, success_response
from app.core.session import get_db
from app.models import Notification, User

router = APIRouter(prefix="/messages", tags=["messages"])


class MessageSend(BaseModel):
    recipient_id: UUID | None = None
    recipient_role: str | None = None  # Send to all users of a role if recipient_id is None
    title: str
    body: str


@router.get("/")
async def list_messages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Notification).where(
        Notification.recipient_id == current_user.id,
        Notification.is_deleted.is_(False),
    ).order_by(Notification.created_at.desc())

    result = await db.execute(query)
    messages = result.scalars().all()
    return success_response(
        data=[
            {
                "id": m.id,
                "title": m.title,
                "body": m.body,
                "is_read": m.is_read,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ]
    )


@router.post("/send", status_code=status.HTTP_201_CREATED)
async def send_message(
    body: MessageSend,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("students:edit")),
):
    if not body.recipient_id and not body.recipient_role:
        raise HTTPException(
            status_code=400,
            detail="Must specify either recipient_id or recipient_role",
        )

    sent_count = 0

    if body.recipient_id:
        # Send to single user
        user_result = await db.execute(
            select(User).where(User.id == str(body.recipient_id), User.is_deleted.is_(False))
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=44, detail="Recipient user not found")

        notification = Notification(
            recipient_id=user.id,
            title=body.title,
            body=body.body,
            is_read=False,
        )
        db.add(notification)
        sent_count = 1
    else:
        # Send to all users of a role
        users_result = await db.execute(
            select(User).where(User.role == body.recipient_role, User.is_deleted.is_(False))
        )
        users = users_result.scalars().all()
        for user in users:
            notification = Notification(
                recipient_id=user.id,
                title=body.title,
                body=body.body,
                is_read=False,
            )
            db.add(notification)
            sent_count += 1

    await db.commit()
    return success_response(
        data={"sent_count": sent_count},
        message=f"Message sent successfully to {sent_count} user(s)",
    )


@router.post("/{message_id}/read")
async def mark_as_read(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == str(message_id),
            Notification.recipient_id == current_user.id,
            Notification.is_deleted.is_(False),
        )
    )
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    message.is_read = True
    await db.commit()
    return success_response(message="Message marked as read")
