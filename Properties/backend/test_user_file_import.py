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
from httpx import AsyncClient, ASGITransport
from app.main import app, lifespan
from app.core.session import AsyncSessionLocal
from sqlalchemy import text

import pytest

@pytest.mark.asyncio
async def test_user_file():
    excel_path = r"C:\Users\thama\Downloads\HIGH - 2026-27.xlsx"
    with open(excel_path, "rb") as f:
        content = f.read()

    async with lifespan(app):
        # Clean up database to allow idempotent runs
        async with AsyncSessionLocal() as db:
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

            # Post HIGH - 2026-27.xlsx bulk import
            files = {"file": ("HIGH - 2026-27.xlsx", content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            data = {"academic_year_id": academic_year_id}

            import_res = await client.post(
                "/api/v1/students/bulk-import",
                headers=headers,
                files=files,
                data=data
            )

            print("IMPORT RESPONSE CODE:", import_res.status_code)
            print("IMPORT RESPONSE BODY SUMMARY:")
            body = import_res.json()
            data_res = body.get("data", {})
            print("  Imported count:", data_res.get("imported"))
            print("  Errors count  :", len(data_res.get("errors", [])))
            if data_res.get("errors"):
                print("  Sample errors (first 5):", data_res.get("errors")[:5])

    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except Exception:
            pass

if __name__ == "__main__":
    asyncio.run(test_user_file())
