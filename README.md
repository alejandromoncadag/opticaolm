# Óptica OLM

Full-stack optometry clinic database system.

**Backend:** FastAPI + PostgreSQL (psycopg)  
**Frontend:** React + TypeScript (Vite)

## What it does
- Multi-branch workflow (sucursales)
- Patients CRUD
- Consultations CRUD
- Sales module (ventas)
- Branch-level stats dashboard
- Role-based access (admin / recepcion / doctor)

## Tech stack
- FastAPI (Python)
- PostgreSQL
- psycopg
- React + TypeScript
- Vite

## Run locally
Prerequisites:
- PostgreSQL 14+
- Python 3.12+
- Node.js 20+

### 1) One-time setup from scratch (DB + schema + seed)
```bash
cd /path/to/opticaolm
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Optional: edit backend/.env with your real values
# - DB_CONNINFO
# - JWT_SECRET
# - FRONTEND_ORIGIN

chmod +x scripts/setup_local_from_scratch.sh scripts/run_local.sh
./scripts/setup_local_from_scratch.sh
```

If `psql` is not in PATH:
```bash
PSQL_BIN=/opt/homebrew/bin/psql ./scripts/setup_local_from_scratch.sh
```

This script does:
1. Create local DB if missing.
2. Apply base schema (`backend/scripts/migrations/000_init_core_schema.sql`).
3. Apply runtime migrations from `backend/main.py`.
4. Seed minimal data:
   - Sucursales (Edomex + Playa)
   - Admin user

### 2) Start backend + frontend
```bash
./scripts/run_local.sh
```

- Backend: `http://127.0.0.1:8000`
- Frontend: `http://127.0.0.1:5173`

## Environment variables
Use `backend/.env` and `frontend/.env`.

Backend (important keys):
- `JWT_SECRET`
- `DB_CONNINFO`
- `FRONTEND_ORIGIN` (comma-separated CORS origins)
- `GOOGLE_SERVICE_ACCOUNT_FILE` or `GOOGLE_SERVICE_ACCOUNT_JSON` (optional, calendar)
- `GOOGLE_CALENDAR_IDS` (optional, calendar by sucursal)

Frontend:
- `VITE_API_URL`

See:
- `backend/.env.example`
- `frontend/.env.example`

## Healthcheck
- `GET /health` → should return `{ "ok": true }`

## Notes
- Use PostgreSQL with UTF-8 encoding.
- Start backend before frontend login.
- `google-service-account.json` and OAuth client JSON files should never be committed.
