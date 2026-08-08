# Siddardha High School

Production-grade School Management System for CBSE/ICSE schools in India.

## Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** FastAPI, SQLAlchemy, Alembic, Pydantic v2
- **Database:** PostgreSQL 15
- **Auth:** JWT (access + refresh tokens)

## Quick Start

### Option A — Docker (recommended for production)

Requires Docker Desktop installed.

```bash
cp .env.example .env
docker compose up -d
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Option B — Local dev (SQLite, no Node/Docker required for API)

**Backend:**

```bash
cd backend
pip install -r requirements.txt
# Uses sqlite+aiosqlite:///./siddardha.db by default
uvicorn app.main:app --reload --port 8000
```

**Frontend** (requires Node.js 20+):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Default Admin

- Email: `admin@school.edu`
- Password: `Admin@12345`

## What's Built (Phase 1 — Parts 1–4)

- Monorepo scaffold (`backend/` + `frontend/`)
- PostgreSQL-ready models (20+ tables) + SQLite local fallback
- JWT auth (login, refresh, logout, change password, `/me`)
- Permission-based RBAC with seeded roles
- Student CRUD API (`/api/v1/students`)
- React UI shell: sidebar, header, role-aware dashboard
- All module routes scaffolded (placeholder pages)
- Students list page wired to API
- Docker Compose for postgres, redis, backend, frontend

## Next Phases

| Phase | Modules |
|---|---|
| 2 | Attendance, Fees, Exams |
| 3 | Admissions/OCR, Library, Transport, Hostel |
| 4 | AI, Reports, Google Sheets, Developer Panel |
