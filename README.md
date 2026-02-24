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

## Backups (PostgreSQL)
Recommended:
- Full backup with `pg_dump` (for disaster recovery)
- CSV exports (for analysis), but not as replacement for DB backup

### Manual backup
```bash
cd /path/to/opticaolm
chmod +x scripts/backup.sh
./scripts/backup.sh
```

Defaults:
- Output dir: `./backups`
- Reads DB vars from `backend/.env`
- Retention by amount:
  - `KEEP_RECENT=14`
  - `KEEP_WEEKLY=12`
  - `KEEP_MONTHLY=12`
- Runs offsite copy after backup (`OFFSITE_ENABLED=true`)

Optional env overrides:
```bash
BACKUP_DIR="$HOME/opticaolm_backups" KEEP_WEEKLY=16 KEEP_MONTHLY=18 ./scripts/backup.sh
```

### Restore backup
```bash
cd /path/to/opticaolm
chmod +x scripts/restore_backup.sh
./scripts/restore_backup.sh /ruta/al/archivo.dump eyecare
```

Also supports schema backups:
```bash
./scripts/restore_backup.sh /ruta/al/schema.sql.gz eyecare
```

### Restore test (disaster recovery drill)
Runs restore into temporary DB `eyecare_restore_test`, validates tables and counts, then drops temp DB.

```bash
cd /path/to/opticaolm
chmod +x scripts/restore_test.sh
./scripts/restore_test.sh
```

Keep temporary DB for inspection:
```bash
DROP_RESTORE_DB=false ./scripts/restore_test.sh
```

### Offsite copy
Script:
```bash
chmod +x scripts/offsite_copy.sh
./scripts/offsite_copy.sh
```

Targets supported:
- iCloud Drive (default): `~/Library/Mobile Documents/com~apple~CloudDocs/OpticaOLM/backups`
- Google Drive (Finder mounted): autodetect or `GDRIVE_DIR=/ruta/...`

Examples:
```bash
# Solo iCloud (default)
OFFSITE_TARGETS=icloud ./scripts/offsite_copy.sh

# iCloud + Google Drive
OFFSITE_TARGETS=icloud,gdrive ./scripts/offsite_copy.sh
```

### Automatic backup on macOS (launchd)
Install weekly schedule (Sunday 03:00):
```bash
cd /path/to/opticaolm
chmod +x scripts/install_backup_launchd.sh scripts/uninstall_backup_launchd.sh
./scripts/install_backup_launchd.sh
```

Custom schedule:
```bash
# weekday hour minute
./scripts/install_backup_launchd.sh 1 2 30
```

If you want an immediate run when installing:
```bash
RUN_AT_LOAD=true ./scripts/install_backup_launchd.sh
```

Verify launchd backup:
```bash
launchctl list | grep com.opticaolm.backup
```

Uninstall:
```bash
./scripts/uninstall_backup_launchd.sh
```

### Automatic restore test on macOS (launchd)
Install monthly (day 1, 04:15):
```bash
chmod +x scripts/install_restore_test_launchd.sh scripts/uninstall_restore_test_launchd.sh
./scripts/install_restore_test_launchd.sh monthly 1 4 15
```

Install weekly (Monday, 04:15):
```bash
./scripts/install_restore_test_launchd.sh weekly 1 4 15
```

Verify launchd restore test:
```bash
launchctl list | grep com.opticaolm.restoretest
```

Uninstall restore test:
```bash
./scripts/uninstall_restore_test_launchd.sh
```

### Paths
- Local backups: `./backups`
- Local logs: `./backups/logs`
- Offsite iCloud: `~/Library/Mobile Documents/com~apple~CloudDocs/OpticaOLM/backups`
- Offsite Google Drive (auto-detected): `~/Library/CloudStorage/GoogleDrive*/.../OpticaOLM/backups`

## Notes
- Use PostgreSQL with UTF-8 encoding.
- Start backend before frontend login.
- `google-service-account.json` and OAuth client JSON files should never be committed.
