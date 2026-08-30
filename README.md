# EduCore ERP

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
# Uses sqlite+aiosqlite:///./educore.db by default
uvicorn app.main:app --reload --port 8000
```

**Frontend** (requires Node.js 20+):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Default Admin & Initial Security

- Email: `admin@school.edu`
- Password: `Admin@12345`

> **IMPORTANT:** On first login with the seeded `admin@school.edu` account, the system enforces a mandatory password change before granting access to the application.

## Backup & Restore Procedures (On-Prem School Installations)

EduCore ERP includes launcher batch scripts designed for non-technical school administrators to perform manual or automated backups.

### 1. Manual Backup (`backup.bat`)
- Double-click `backup.bat` in the project root directory.
- Dumps the live database into a timestamped file inside the `backups/` folder (e.g. `backups\educore_backup_YYYYMMDD_HHMMSS.sql` or `.db`).
- Supports both **Docker PostgreSQL** container deployments and **Local SQLite** dev instances.

### 2. Automated Daily Backups (Windows Task Scheduler)
To schedule automatic daily backups at 11:00 PM:
1. Open **Windows Task Scheduler** (`taskschd.msc`).
2. Click **Create Basic Task** and name it `EduCore ERP Daily Backup`.
3. Trigger: **Daily** at `23:00` (11:00 PM).
4. Action: **Start a program**.
5. Program/script: `C:\path\to\Siddardha High School\backup.bat`.
6. Add arguments: `--silent`.
7. Start in: `C:\path\to\Siddardha High School`.

### 3. Restoring a Backup (`restore.bat`)
1. Double-click `restore.bat` or run `restore.bat <backup_filepath>`.
2. Review the list of available backups in the `backups/` folder.
3. Confirm the interactive safety prompt (`WARNING: OVERWRITING LIVE DATABASE!`).
4. The database will be overwritten with the selected snapshot data.

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
