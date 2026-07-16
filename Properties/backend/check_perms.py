import asyncio
from sqlalchemy import select
from app.core.session import AsyncSessionLocal
from app.models import User, Permission, RolePermission

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.email == "admin@school.edu"))
        user = res.scalar_one_or_none()
        if not user:
            print("User admin@school.edu not found")
            return
        print(f"User: {user.email}, Role: {user.role}")
        
        # Check permissions for this role in the DB
        res_perms = await db.execute(
            select(Permission.name)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role == user.role)
        )
        perms = [row[0] for row in res_perms.all()]
        print(f"DB permissions for role {user.role}: {perms}")

if __name__ == "__main__":
    asyncio.run(check())
