import os

# Set test database url
db_file = "test_siddardha.db"
db_path = os.path.join(os.path.dirname(__file__), db_file)
if os.path.exists(db_path):
    try:
        os.remove(db_path)
    except Exception:
        pass

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"

import asyncio
import io
import openpyxl
from httpx import AsyncClient, ASGITransport
from app.main import app, lifespan

import pytest

@pytest.mark.asyncio
async def test_excel_import():
    # 1. Create sample Excel in-memory with openpyxl (18 headers matching school layout, 525 records)
    wb = openpyxl.Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "Students"

    headers_18 = [
        "SECTION", "NAME OF THE STUDENT", "SURNAME", "PEN NO", "AADHAAR NO",
        "FATHER NAME", "MOTHER NAME", "R.NO", "ADMIN NO", "CASTE",
        "SUB CASTE", "DOB", "VILLAGE", "MOBILE", "EXTRA CELL NO", "HOSTEL", "H.NO"
    ]
    ws.append(headers_18)

    # Append 525 student records across sections A, B, G
    sections = ["A", "B", "G"]
    for i in range(1, 526):
        sec = sections[i % 3]
        ws.append([
            sec,
            f"STUDENT_{i}",
            f"SURNAME_{i}",
            f"20287071{i:04d}",
            f"68375594{i:04d}",
            f"FATHER_{i}",
            f"MOTHER_{i}",
            str((i % 50) + 1),
            f"ADM2026_{i:04d}",
            "SC" if i % 2 == 0 else "BC",
            "MADIGA" if i % 2 == 0 else "VADDERA",
            "12/07/2014",
            "AKKAPALEM",
            f"98765{i:05d}",
            f"91234{i:05d}",
            "H-01" if i % 5 == 0 else "",
            f"H.NO-{i}"
        ])

    excel_bytes = io.BytesIO()
    wb.save(excel_bytes)
    excel_content = excel_bytes.getvalue()

    from app.core.session import AsyncSessionLocal
    from sqlalchemy import text, select
    from app.models import Student, Parent

    async with lifespan(app):
        # Clean up database to allow idempotent runs
        async with AsyncSessionLocal() as db:
            await db.execute(text("DELETE FROM parents"))
            await db.execute(text("DELETE FROM students"))
            await db.commit()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            # Login as Admin
            login_res = await client.post(
                "/api/v1/auth/login",
                json={"email_or_phone": "admin@school.edu", "password": "Admin@12345"}
            )
            token = login_res.json().get("data", {}).get("access_token")
            headers = {"Authorization": f"Bearer {token}"}

            # Get academic year ID
            years_res = await client.get("/api/v1/students/academic/years", headers=headers)
            years = years_res.json().get("data", [])
            academic_year_id = years[0]["id"] if years else None
            assert academic_year_id, "Academic year not found"

            # Post Excel bulk import with 525 records
            files = {"file": ("siddardha_500_students.xlsx", excel_content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            data = {"academic_year_id": academic_year_id}

            import_res = await client.post(
                "/api/v1/students/bulk-import",
                headers=headers,
                files=files,
                data=data
            )

            print("IMPORT RESPONSE CODE:", import_res.status_code)
            print("IMPORT RESPONSE BODY:", import_res.json())

            assert import_res.status_code == 200
            res_data = import_res.json().get("data", {})
            assert res_data.get("imported") == 525, f"Expected 525 imported, got {res_data.get('imported')}"
            
            # Verify parents were auto-created
            async with AsyncSessionLocal() as db:
                st_count = (await db.execute(select(Student))).scalars().all()
                par_count = (await db.execute(select(Parent))).scalars().all()
                assert len(st_count) == 525, f"Expected 525 students in DB, got {len(st_count)}"
                assert len(par_count) == 525 * 2, f"Expected {525 * 2} parents in DB (father + mother), got {len(par_count)}"

            print(f"\nSUCCESS! All 525 rows imported cleanly with {len(par_count)} father and mother parent records created!")

    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except Exception:
            pass

if __name__ == "__main__":
    asyncio.run(test_excel_import())
