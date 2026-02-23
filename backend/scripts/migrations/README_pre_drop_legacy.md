# Pre-legacy drop checklist (Óptica OLM)

Este documento describe el flujo **sin riesgo** antes de borrar columnas legacy.

## 1) Backup (obligatorio)

Recomendado (dump completo + schema):

```bash
/Users/alejandromoncadag/opticaolm/backend/scripts/backup_pre_migration.sh
```

Opcional con ruta destino:

```bash
/Users/alejandromoncadag/opticaolm/backend/scripts/backup_pre_migration.sh /Users/alejandromoncadag/Desktop/opticaolm_backups
```

Variables opcionales:

- `DB_HOST` (default `localhost`)
- `DB_PORT` (default `5432`)
- `DB_NAME` (default `eyecare`)
- `DB_USER` (default `alejandromoncadag`)

## 2) Smoke test pre-migración

Ejecuta export + verificador + escaneo de referencias runtime:

```bash
/Users/alejandromoncadag/opticaolm/.venv/bin/python \
  /Users/alejandromoncadag/opticaolm/backend/scripts/smoke_pre_legacy_drop.py \
  --project-root /Users/alejandromoncadag/opticaolm \
  --anio 2026 \
  --output-dir /Users/alejandromoncadag/opticaolm/exports/csv
```

Reportes:

- `exports/csv/catalogos/2026/legacy_referencias_runtime.csv`
- `exports/csv/catalogos/2026/legacy_referencias_runtime_resumen.csv`

> La migración solo debe aplicarse cuando este smoke test esté en `RESULTADO: OK`.

## 3) Migración preparada (NO ejecutar aún)

Archivo preparado:

- `backend/scripts/migrations/20260222_prepare_drop_legacy_columns.sql`

Características:

- Idempotente (`DROP COLUMN IF EXISTS`)
- Valida dependencias en `VIEW`s antes de dropear
- Registra drops en `core.schema_change_log`

## 4) Rollback si algo falla

Restaurar desde dump custom:

```bash
/Users/alejandromoncadag/opticaolm/backend/scripts/restore_from_backup.sh /ruta/al/backup.dump eyecare
```

Este restore usa:

- `--clean`
- `--if-exists`

para reconstruir objetos previos y revertir cambios de schema/datos.

## 5) Contrato de diccionarios

- **Source of truth físico:** `exports/csv/catalogos/2026/diccionario_columnas_fisico.csv`
- **Modelo completo:** `exports/csv/catalogos/2026/diccionario_modelo_completo.csv`
- **Exports canónicos:** `exports/csv/catalogos/2026/diccionario_exports_canonicos.csv`
- **Legacy no canónicas detectadas:** `exports/csv/catalogos/2026/columnas_legacy_no_canonicas.csv`
