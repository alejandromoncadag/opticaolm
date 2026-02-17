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

### Backend
```bash
cd backend
source ../.venv/bin/activate
uvicorn main:app --reload
```

Backend runs at `http://127.0.0.1:8000`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://127.0.0.1:5173`.

## Environment variables
Use `backend/.env` for runtime variables. Important keys include:
- `JWT_SECRET`
- `DB_CONNINFO`
- `GOOGLE_SERVICE_ACCOUNT_FILE` or `GOOGLE_SERVICE_ACCOUNT_JSON` (optional, calendar)
- `GOOGLE_CALENDAR_IDS` (optional, calendar by sucursal)

## Notes
- Use PostgreSQL with UTF-8 encoding.
- Start backend before frontend login.
- `google-service-account.json` and OAuth client JSON files should never be committed.
