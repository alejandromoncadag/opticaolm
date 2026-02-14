# Óptica OLM

Full-stack optometry clinic database system.

**Backend:** FastAPI + PostgreSQL (psycopg)  
**Frontend:** React + TypeScript (Vite)

## What it does
- Multi-branch workflow (sucursales)
- Patients CRUD
- Consultations CRUD
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
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
