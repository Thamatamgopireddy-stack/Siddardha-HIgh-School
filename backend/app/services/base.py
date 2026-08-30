from typing import Generic, Type, TypeVar
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import utcnow
from app.models import User

ModelType = TypeVar("ModelType")
CreateSchema = TypeVar("CreateSchema")
UpdateSchema = TypeVar("UpdateSchema")


class CRUDService(Generic[ModelType, CreateSchema, UpdateSchema]):
    def __init__(self, model: Type[ModelType], db: AsyncSession):
        self.model = model
        self.db = db

    async def get(self, id: UUID) -> ModelType | None:
        result = await self.db.execute(
            select(self.model).where(self.model.id == id, self.model.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def get_multi(
        self, *, skip: int = 0, limit: int = 20, filters: dict | None = None
    ) -> tuple[list[ModelType], int]:
        query = select(self.model).where(self.model.is_deleted.is_(False))
        count_query = select(func.count()).select_from(self.model).where(self.model.is_deleted.is_(False))

        if filters:
            for key, value in filters.items():
                if value is not None and hasattr(self.model, key):
                    query = query.where(getattr(self.model, key) == value)
                    count_query = count_query.where(getattr(self.model, key) == value)

        total = (await self.db.execute(count_query)).scalar() or 0
        result = await self.db.execute(query.offset(skip).limit(limit))
        return list(result.scalars().all()), total

    async def soft_delete(self, id: UUID, deleted_by: UUID) -> ModelType | None:
        obj = await self.get(id)
        if not obj:
            return None
        obj.is_deleted = True
        obj.deleted_at = utcnow()
        obj.deleted_by = deleted_by
        await self.db.flush()
        return obj

    async def exists(self, **kwargs) -> bool:
        query = select(self.model).where(self.model.is_deleted.is_(False))
        for key, value in kwargs.items():
            query = query.where(getattr(self.model, key) == value)
        result = await self.db.execute(query.limit(1))
        return result.scalar_one_or_none() is not None
