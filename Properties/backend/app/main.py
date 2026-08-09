import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import text

from app.core.config import settings
from app.core.dependencies import load_role_permissions
from app.core.session import AsyncSessionLocal, engine
from app.core.database import Base
from app import models  # noqa: F401 — register all ORM models
from app.services.seed import seed_database
from app.routers import auth, students, admissions, integrations, attendance, exams, fees, ancillary, ai, reports, developer, teachers, timetable, payroll, hr, notice_board, messages, circulars, dashboard, websocket

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("siddardha")

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with AsyncSessionLocal() as db:
            await seed_database(db)
            await load_role_permissions(db)
            await db.commit()
    except Exception as e:
        logger.error(f"Error during app startup initialization: {e}", exc_info=True)
    yield
    await engine.dispose()


app = FastAPI(title="Siddardha High School", version=settings.APP_VERSION, lifespan=lifespan)
static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "static"))
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = round((time.perf_counter() - start) * 1000, 2)
    logger.info(
        '{"method":"%s","path":"%s","status":%s,"duration_ms":%s}',
        request.method,
        request.url.path,
        response.status_code,
        duration,
    )
    return response


async def set_body(request: Request, body: bytes):
    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}
    request._receive = receive


@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        body_bytes = b""
        try:
            body_bytes = await request.body()
            await set_body(request, body_bytes)
        except Exception:
            pass

        response = await call_next(request)

        if 200 <= response.status_code < 300:
            user_id = None
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                try:
                    token = auth_header[7:]
                    from app.core.security import decode_token
                    payload = decode_token(token)
                    if payload.get("type") == "access":
                        user_id = payload.get("sub")
                except Exception:
                    pass

            path_parts = request.url.path.strip("/").split("/")
            module = "general"
            if len(path_parts) >= 3:
                module = path_parts[2]
            elif len(path_parts) >= 2:
                module = path_parts[1]

            action = f"{request.method} {request.url.path}"

            import json
            new_values = None
            if body_bytes and "/auth/login" not in request.url.path:
                try:
                    new_values = json.loads(body_bytes.decode("utf-8"))
                    if isinstance(new_values, dict):
                        for k in ["password", "current_password", "new_password", "password_hash"]:
                            if k in new_values:
                                new_values[k] = "********"
                except Exception:
                    pass

            try:
                from app.core.session import AsyncSessionLocal
                from app.models.audit import AuditLog
                async with AsyncSessionLocal() as db:
                    log = AuditLog(
                        user_id=user_id,
                        action=action,
                        module=module,
                        new_values=new_values,
                    )
                    db.add(log)
                    await db.commit()
            except Exception as e:
                logger.error(f"Failed to save audit log: {e}")
        return response
    else:
        return await call_next(request)



@app.get("/api/v1/health")
async def health():
    db_ok = redis_ok = "ok"
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
    except Exception:
        db_ok = "error"
    try:
        import redis

        r = redis.from_url(settings.REDIS_URL)
        r.ping()
    except Exception:
        redis_ok = "unavailable"
    return JSONResponse(
        {
            "success": True,
            "data": {
                "status": "ok" if db_ok == "ok" else "degraded",
                "db": db_ok,
                "redis": redis_ok,
                "celery": "stub",
                "version": settings.APP_VERSION,
            },
            "message": "Health check",
        }
    )


app.include_router(auth.router, prefix="/api/v1")
app.include_router(students.router, prefix="/api/v1")
app.include_router(admissions.router, prefix="/api/v1")
app.include_router(integrations.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")
app.include_router(exams.router, prefix="/api/v1")
app.include_router(fees.router, prefix="/api/v1")
app.include_router(ancillary.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(developer.router, prefix="/api/v1")
app.include_router(teachers.router, prefix="/api/v1")
app.include_router(timetable.router, prefix="/api/v1")
app.include_router(payroll.router, prefix="/api/v1")
app.include_router(hr.router, prefix="/api/v1")
app.include_router(notice_board.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")
app.include_router(circulars.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(websocket.router, prefix="/api/v1")


import os
from fastapi.responses import FileResponse, HTMLResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

possible_dist_dirs = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "Properties", "frontend", "dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "dist")),
    os.path.abspath(os.path.join(os.getcwd(), "frontend", "dist")),
    os.path.abspath(os.path.join(os.getcwd(), "dist")),
    os.path.abspath(os.path.join(os.getcwd(), "..", "frontend", "dist")),
    os.path.abspath(os.path.join(os.getcwd(), "Properties", "frontend", "dist")),
    os.path.abspath(os.path.join(os.getcwd(), "..", "Properties", "frontend", "dist")),
    "/opt/render/project/src/frontend/dist",
    "/opt/render/project/src/Properties/frontend/dist",
]
FRONTEND_DIST_DIR = next((d for d in possible_dist_dirs if os.path.exists(d)), None)

class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            response = await super().get_response(path, scope)
            if response.status_code == 404:
                last_segment = path.split("/")[-1] if path else ""
                if "." not in last_segment:
                    index_path = os.path.join(self.directory or "", "index.html")
                    if os.path.exists(index_path):
                        return FileResponse(index_path)
            return response
        except (StarletteHTTPException, Exception):
            last_segment = path.split("/")[-1] if path else ""
            if "." not in last_segment:
                index_path = os.path.join(self.directory or "", "index.html")
                if os.path.exists(index_path):
                    return FileResponse(index_path)
            raise

if FRONTEND_DIST_DIR and os.path.exists(FRONTEND_DIST_DIR):
    logger.info(f"Mounted SPA static frontend from: {FRONTEND_DIST_DIR}")
    app.mount("/", SPAStaticFiles(directory=FRONTEND_DIST_DIR, html=True), name="frontend")
else:
    logger.warning(
        "Frontend dist directory not found. SPA routing disabled. "
        "Ensure 'bash Properties/backend/build.sh' is set as Build Command on Render."
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def fallback_not_found(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "API endpoint not found"})
        return HTMLResponse(
            content="""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Siddardha High School - Deployment Notice</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .card { background: #1e293b; border-radius: 12px; padding: 32px; max-width: 580px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); border: 1px solid #334155; text-align: center; }
        h1 { font-size: 1.5rem; color: #38bdf8; margin-top: 0; }
        p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; }
        .code-block { background: #0f172a; color: #4ade80; padding: 12px 16px; border-radius: 8px; font-family: monospace; font-size: 0.9rem; text-align: left; overflow-x: auto; margin: 16px 0; border: 1px solid #334155; }
        .steps { text-align: left; background: #0f172a; padding: 16px 20px; border-radius: 8px; font-size: 0.875rem; color: #cbd5e1; margin-top: 16px; }
        .steps ol { margin: 0; padding-left: 20px; }
        .steps li { margin-bottom: 8px; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Siddardha High School Server is Live</h1>
        <p>The backend API is running, but the frontend React app was not built during deployment on Render.</p>
        <div class="steps">
            <strong>To fix this in your Render Dashboard:</strong>
            <ol>
                <li>Go to your <strong>Render Dashboard</strong> &rarr; select this Web Service</li>
                <li>Go to <strong>Settings</strong> &rarr; scroll to <strong>Build Command</strong></li>
                <li>Set the <strong>Build Command</strong> to:</li>
            </ol>
        </div>
        <div class="code-block">bash build.sh</div>
        <p style="font-size: 0.85rem; color: #64748b;">(Or if Root Directory is empty: <code>bash Properties/backend/build.sh</code>)</p>
        <p style="font-size: 0.85rem; color: #64748b;">Save changes and click <strong>Manual Deploy &rarr; Deploy latest commit</strong>.</p>
    </div>
</body>
</html>""",
            status_code=200
        )


