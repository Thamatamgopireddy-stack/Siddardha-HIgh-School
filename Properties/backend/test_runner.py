import asyncio
import logging
from httpx import AsyncClient, ASGITransport
from app.main import app, lifespan

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("module_runner")

async def run_all_modules():
    logger.info("Starting verification of all modules...")
    
    # Run lifespan context to ensure DB tables & seeds are created
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            # Login with correct field: email_or_phone
            login_res = await client.post(
                "/api/v1/auth/login",
                json={"email_or_phone": "admin@school.edu", "password": "Admin@12345"}
            )
            
            token = ""
            if login_res.status_code == 200:
                res_data = login_res.json()
                token = res_data.get("data", {}).get("access_token", "")
                logger.info(f"Successfully authenticated as Admin. Token acquired: {token[:15]}...")
            else:
                logger.error(f"Login failed ({login_res.status_code}): {login_res.text}")

            headers = {"Authorization": f"Bearer {token}"} if token else {}

            passed = 0
            failed = 0

            # List of all routes registered in app
            routes_to_test = [r for r in app.routes if getattr(r, "path", "").startswith("/api/v1")]
            logger.info(f"Found {len(routes_to_test)} endpoints under /api/v1.")

            for route in routes_to_test:
                path = getattr(route, "path", "")
                methods = getattr(route, "methods", set())
                
                # Filter out standard non-GET/POST or path param routes if needed
                for method in methods:
                    if method in ("HEAD", "OPTIONS"):
                        continue
                    
                    if "{" in path:
                        # Skip routes requiring path variables like {id} for bulk check
                        continue

                    try:
                        if method == "GET":
                            res = await client.get(path, headers=headers)
                        elif method == "POST":
                            res = await client.post(path, headers=headers, json={})
                        elif method == "PUT":
                            res = await client.put(path, headers=headers, json={})
                        elif method == "DELETE":
                            res = await client.delete(path, headers=headers)
                        else:
                            continue

                        status = res.status_code
                        # 200, 201, 204, 400, 422 are expected HTTP responses (valid application level handling)
                        if status in (200, 201, 204, 400, 422):
                            logger.info(f"[PASS] {method:<6} {path:<45} -> Status {status}")
                            passed += 1
                        else:
                            logger.error(f"[FAIL] {method:<6} {path:<45} -> Status {status} | Body: {res.text[:120]}")
                            failed += 1
                    except Exception as e:
                        logger.error(f"[ERR]  {method:<6} {path:<45} -> Exception: {e}")
                        failed += 1

            print("\n" + "="*70)
            print(f" Siddardha High School - Module Verification Summary")
            print(f" Total Endpoints Tested : {passed + failed}")
            print(f" Passed Endpoints       : {passed}")
            print(f" Failed Endpoints       : {failed}")
            print("="*70 + "\n")

if __name__ == "__main__":
    asyncio.run(run_all_modules())
