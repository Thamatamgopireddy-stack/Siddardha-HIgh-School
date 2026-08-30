import asyncio
import io
import csv
from uuid import uuid4
from datetime import date
from sqlalchemy import select, func

from app.core.session import AsyncSessionLocal
from app.models import Student, AcademicYear, Section
from app.services.bulk_import_service import execute_generic_bulk_import, STUDENT_IMPORT_CONFIG, generate_error_report_csv

class MockUser:
    id = str(uuid4())
    first_name = "Admin"
    last_name = "User"
    role = "school_admin"
    permissions = ["students:create"]

class MockUploadFile:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self._content = content

    async def read(self):
        return self._content


async def run_tests():
    print("=== STARTING GENERIC BULK IMPORT VERIFICATION TESTS ===")
    async with AsyncSessionLocal() as db:
        ay_res = await db.execute(select(AcademicYear).limit(1))
        ay = ay_res.scalar_one_or_none()
        if not ay:
            print("[ERROR] No academic year found!")
            return

        sec_res = await db.execute(select(Section).limit(1))
        sec = sec_res.scalar_one_or_none()

        # Count initial students
        initial_count = (await db.execute(select(func.count()).select_from(Student).where(Student.is_deleted.is_(False)))).scalar() or 0
        print(f"[TEST PREP] Initial students in DB: {initial_count}")

        # -------------------------------------------------------------
        # Create CSV File with 10 Rows (8 Valid, 2 Invalid)
        # Invalid 1: Row 5 -> Missing required field 'First Name'
        # Invalid 2: Row 9 -> Duplicate Admission Number (uses Row 1's admission number)
        # -------------------------------------------------------------
        prefix = f"GENIMP{uuid4().hex[:4].upper()}"
        unique_dup_id = f"{prefix}-01"

        rows = [
            ["Admission Number", "First Name", "Last Name", "Date of Birth", "Gender"],
            [unique_dup_id, "Aarav", "Sharma", "2010-01-10", "Male"],          # Row 1 (Valid)
            [f"{prefix}-02", "Bhavya", "Patel", "2011-02-12", "Female"],        # Row 2 (Valid)
            [f"{prefix}-03", "Chirag", "Verma", "2010-03-15", "Male"],          # Row 3 (Valid)
            [f"{prefix}-04", "Deepa", "Reddy", "2011-04-18", "Female"],         # Row 4 (Valid)
            [f"{prefix}-05", "", "InvalidMissingName", "2010-05-20", "Male"],   # Row 5 (INVALID: Missing First Name)
            [f"{prefix}-06", "Farhan", "Khan", "2011-06-22", "Male"],           # Row 6 (Valid)
            [f"{prefix}-07", "Gita", "Sen", "2010-07-25", "Female"],            # Row 7 (Valid)
            [f"{prefix}-08", "Harsh", "Joshi", "2011-08-28", "Male"],           # Row 8 (Valid)
            [unique_dup_id, "Inaya", "DuplicateID", "2010-09-30", "Female"],    # Row 9 (INVALID: Duplicate Admission Number)
            [f"{prefix}-10", "Jai", "Kumar", "2011-10-05", "Male"],             # Row 10 (Valid)
        ]

        csv_out = io.StringIO()
        writer = csv.writer(csv_out)
        writer.writerows(rows)
        csv_bytes = csv_out.getvalue().encode("utf-8")

        # -------------------------------------------------------------
        # STEP 1: Dry-Run Preview Mode (dry_run=True)
        # -------------------------------------------------------------
        print("\n--- STEP 1: DRY-RUN PREVIEW MODE ---")
        preview_res = await execute_generic_bulk_import(
            file_bytes=csv_bytes,
            filename="test_10_rows.csv",
            config=STUDENT_IMPORT_CONFIG,
            db=db,
            dry_run=True,
            extra_kwargs={"academic_year_id": str(ay.id), "section_id": str(sec.id) if sec else None}
        )
        print(f"[PREVIEW RESULT] Total Rows: {preview_res['total_rows']}, Valid: {preview_res['valid_count']}, Invalid: {preview_res['invalid_count']}")
        print(f"[PREVIEW ERRORS] {preview_res['errors']}")

        assert preview_res["total_rows"] == 10, f"Expected 10 total rows, got {preview_res['total_rows']}"
        assert preview_res["valid_count"] == 8, f"Expected 8 valid rows, got {preview_res['valid_count']}"
        assert preview_res["invalid_count"] == 2, f"Expected 2 invalid rows, got {preview_res['invalid_count']}"
        assert len(preview_res["errors"]) == 2, f"Expected 2 error entries, got {len(preview_res['errors'])}"

        # Verify zero DB mutation during dry-run preview
        db_count_after_preview = (await db.execute(select(func.count()).select_from(Student).where(Student.is_deleted.is_(False)))).scalar() or 0
        print(f"[PREVIEW CHECK] Students in DB after Preview: {db_count_after_preview} (Matches Initial: {db_count_after_preview == initial_count})")
        assert db_count_after_preview == initial_count, "Dry-run preview MUST NOT commit any records to database!"
        print("[SUCCESS] DRY-RUN PREVIEW MODE VERIFIED: Correctly flagged 2 problem rows with ZERO database commits.")

        # -------------------------------------------------------------
        # STEP 2: Confirm Import Mode (dry_run=False)
        # -------------------------------------------------------------
        print("\n--- STEP 2: CONFIRM IMPORT MODE ---")
        confirm_res = await execute_generic_bulk_import(
            file_bytes=csv_bytes,
            filename="test_10_rows.csv",
            config=STUDENT_IMPORT_CONFIG,
            db=db,
            dry_run=False,
            extra_kwargs={"academic_year_id": str(ay.id), "section_id": str(sec.id) if sec else None}
        )
        print(f"[CONFIRM RESULT] Total Rows: {confirm_res['total_rows']}, Valid/Committed: {confirm_res['valid_count']}, Invalid: {confirm_res['invalid_count']}")

        assert confirm_res["valid_count"] == 8, f"Expected 8 committed records, got {confirm_res['valid_count']}"
        assert confirm_res["invalid_count"] == 2, f"Expected 2 invalid records, got {confirm_res['invalid_count']}"

        # Verify DB Count updated by exactly 8
        db_count_after_confirm = (await db.execute(select(func.count()).select_from(Student).where(Student.is_deleted.is_(False)))).scalar() or 0
        print(f"[CONFIRM CHECK] Final Students in DB: {db_count_after_confirm}")
        assert db_count_after_confirm == initial_count + 8, f"Expected {initial_count + 8} in DB, got {db_count_after_confirm}"
        print("[SUCCESS] CONFIRM IMPORT MODE VERIFIED: Exactly 8 valid rows committed to database.")

        # -------------------------------------------------------------
        # STEP 3: Error Report CSV Generation
        # -------------------------------------------------------------
        print("\n--- STEP 3: ERROR REPORT CSV GENERATION ---")
        csv_report = generate_error_report_csv(confirm_res["errors"])
        print(f"[ERROR REPORT CSV OUTPUT]:\n{csv_report}")

        assert "Missing required field 'First Name'" in csv_report, "Error report missing required field error"
        assert "Duplicate admission number" in csv_report or "Duplicate" in csv_report, "Error report missing duplicate admission number error"
        print("[SUCCESS] ERROR REPORT CSV VERIFIED: Contains accurate failure reasons for all 2 failing rows.")

    print("\nALL GENERIC BULK IMPORT VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_tests())
