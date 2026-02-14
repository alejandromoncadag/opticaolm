# Óptica OLM

Full-stack optometry clinic database system.

**Backend:** FastAPI + PostgreSQL (psycopg)  
**Frontend:** React + TypeScript (Vite)

## What it does
- Multi-branch workflow (sucursales)
- Patients CRUD
- Consultations CRUD
- Clinical history module
- Role-based access (`admin` / `recepcion` / `doctor`)

## Tech stack
- FastAPI (Python)
- PostgreSQL
- psycopg
- React + TypeScript
- Vite

## Run locally

### 1) Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at: `http://127.0.0.1:8000`

### 2) Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

## Environment variables
Create `backend/.env` with:

```env
JWT_SECRET=your_secret_here
```

Update PostgreSQL connection in `backend/main.py` (`DB_CONNINFO`) or move it to `.env`.

## Notes
- Use PostgreSQL with UTF-8 encoding.
- Backend includes startup migrations for some clinical history fields.
- Make sure backend is running before frontend login.
