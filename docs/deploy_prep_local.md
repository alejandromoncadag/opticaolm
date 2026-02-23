# Guía de Deploy Prep (Local)

Esta guía deja una instalación limpia desde cero para pruebas de pre-producción.

## Requisitos
- PostgreSQL 14+
- Python 3.12+
- Node.js 20+

## A. Configurar variables
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Editar mínimo en `backend/.env`:
- `DB_CONNINFO`
- `JWT_SECRET`
- `FRONTEND_ORIGIN`
- `SEED_ADMIN_PASSWORD`

## B. Levantar desde cero (con script)
```bash
chmod +x scripts/setup_local_from_scratch.sh scripts/run_local.sh
./scripts/setup_local_from_scratch.sh
```

Si `psql` no está en PATH:
```bash
PSQL_BIN=/opt/homebrew/bin/psql ./scripts/setup_local_from_scratch.sh
```

### Qué ejecuta internamente
1. Crea la base de datos si no existe.
2. Aplica schema base:
   - `backend/scripts/migrations/000_init_core_schema.sql`
3. Aplica migraciones runtime del backend:
   - `backend/scripts/apply_runtime_migrations.py`
4. Carga seed mínimo:
   - `backend/scripts/seed_minimo.py`

## C. Ejecutar app
```bash
./scripts/run_local.sh
```

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`

## D. Verificación rápida
```bash
curl http://127.0.0.1:8000/health
```

Debe responder:
```json
{"ok": true}
```

## E. Comandos manuales (sin script)
Si prefieres ejecutar todo manual:

```bash
# 1) Crear DB
psql "host=localhost port=5432 dbname=postgres user=postgres" \
  -c "CREATE DATABASE eyecare;" || true

# 2) Schema base
psql "host=localhost port=5432 dbname=eyecare user=postgres" \
  -f backend/scripts/migrations/000_init_core_schema.sql

# 3) Runtime migrations
cd backend
../.venv/bin/python scripts/apply_runtime_migrations.py

# 4) Seed mínimo
../.venv/bin/python scripts/seed_minimo.py
cd ..

# 5) Run
./scripts/run_local.sh
```
