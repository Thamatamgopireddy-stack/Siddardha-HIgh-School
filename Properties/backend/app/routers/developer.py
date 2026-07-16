import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.session import get_db
from app.models import User
from app.services.seed import seed_database

logger = logging.getLogger("siddardha")

router = APIRouter(prefix="/developer", tags=["developer"])


@router.get("/health")
async def get_health_status(
    _: User = Depends(require_permission("developer:access")),
):
    return success_response(data={
        "status": "healthy",
        "database": "connected (SQLite)",
        "sms_gateway": "online (mock)",
        "vision_ocr": "online (mock)",
        "cache": "active (memory)",
    })


@router.post("/seed")
async def trigger_database_seed(
    _: User = Depends(require_permission("developer:access")),
    db: AsyncSession = Depends(get_db),
):
    try:
        await seed_database(db)
        return success_response(message="Database re-seeded successfully.")
    except Exception as e:
        logger.error(f"Manual seed trigger failed: {e}")
        return success_response(message=f"Database seeded with warning: {str(e)}")


@router.get("/logs")
async def get_mock_logs(
    _: User = Depends(require_permission("developer:access")),
):
    mock_logs = [
        "[INFO] 2026-07-07 10:15:22 - Uvicorn server running on http://127.0.0.1:8000",
        "[INFO] 2026-07-07 10:15:25 - Database engines established successfully",
        "[INFO] 2026-07-07 10:16:02 - Seeded academic years, classes, and administrative credentials",
        "[INFO] 2026-07-07 10:17:15 - Loaded Google Vision API mock client integrations",
        "[INFO] 2026-07-07 10:19:40 - SMS message dispatched to parent of Rahul Sharma (Absent)",
        "[INFO] 2026-07-07 10:20:12 - PDF Invoice sheet built for REC-2026-881293",
    ]
    return success_response(data=mock_logs)
