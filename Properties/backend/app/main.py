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
from fastapi.responses import FileResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

possible_dist_dirs = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")),
    os.path.abspath(os.path.join(os.getcwd(), "frontend", "dist")),
    os.path.abspath(os.path.join(os.getcwd(), "..", "frontend", "dist")),
    os.path.abspath(os.path.join(os.getcwd(), "Properties", "frontend", "dist")),
]
FRONTEND_DIST_DIR = next((d for d in possible_dist_dirs if os.path.exists(d)), possible_dist_dirs[0])

class SPAStaticFiles(StaticFiles):
    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            return
        await super().__call__(scope, receive, send)

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except (StarletteHTTPException, Exception) as e:
            if isinstance(e, StarletteHTTPException) and e.status_code == 404:
                last_segment = path.split("/")[-1] if path else ""
                if "." not in last_segment:
                    index_path = os.path.join(self.directory or "", "index.html")
                    if os.path.exists(index_path):
                        return FileResponse(index_path)
            raise e

if os.path.exists(FRONTEND_DIST_DIR):
    app.mount("/", SPAStaticFiles(directory=FRONTEND_DIST_DIR, html=True), name="frontend")
else:
    logger.warning(f"Frontend dist directory not found at: {FRONTEND_DIST_DIR}. SPA routing is disabled.")


