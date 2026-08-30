import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.session import get_db
from app.models import Staff, User
from app.services.bulk_import_service import (
    execute_generic_bulk_import,
    TEACHER_IMPORT_CONFIG,
    generate_error_report_csv,
)

logger = logging.getLogger("educore")

router = APIRouter(prefix="/teachers", tags=["teachers"])


@router.post("/bulk-import")
async def bulk_import_teachers(
    file: UploadFile = File(...),
    dry_run: bool = Form(True),
    current_user: User = Depends(require_permission("users:edit")),
    db: AsyncSession = Depends(get_db),
):
    try:
        content = await file.read()
        res = await execute_generic_bulk_import(
            file_bytes=content,
            filename=file.filename,
            config=TEACHER_IMPORT_CONFIG,
            db=db,
            dry_run=dry_run,
            extra_kwargs={"user_id": current_user.id}
        )
        error_strings = [f"Row {e['row']}: {e['reason']}" for e in res["errors"]]
        return success_response(
            data={
                "imported": res["valid_count"],
                "total_rows": res["total_rows"],
                "invalid_count": res["invalid_count"],
                "dry_run": res["dry_run"],
                "errors": error_strings,
                "error_details": res["errors"],
                "preview_sample": res["preview_sample"],
            },
            message=f"{'Preview:' if dry_run else 'Import completed:'} {res['valid_count']} valid rows, {res['invalid_count']} invalid rows."
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bulk-import/error-report")
async def download_teacher_import_error_report(
    errors: list[dict],
    _: User = Depends(require_permission("users:edit")),
):
    csv_content = generate_error_report_csv(errors)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=teacher_import_errors.csv"}
    )
