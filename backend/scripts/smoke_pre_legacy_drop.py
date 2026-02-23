#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path


def run(cmd: list[str], cwd: Path | None = None) -> None:
    print("$", " ".join(cmd))
    subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=True)


def load_legacy_targets(path: Path) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    with path.open("r", encoding="utf-8", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            table = str(row.get("tabla") or "").strip()
            col = str(row.get("columna") or "").strip()
            if table and col:
                out.append((table, col))
    return out


def scan_file_for_columns(path: Path, columns: set[str]) -> list[tuple[str, int, str]]:
    hits: list[tuple[str, int, str]] = []
    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    patterns = {c: re.compile(rf"\b{re.escape(c)}\b") for c in columns}
    for i, line in enumerate(lines, start=1):
        for col, pat in patterns.items():
            if pat.search(line):
                hits.append((col, i, line.strip()))
    return hits


def write_hits_report(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["archivo", "tabla", "columna", "linea", "snippet"])
        w.writeheader()
        w.writerows(rows)


def build_table_context(path: Path) -> dict[int, str | None]:
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    table_by_line: dict[int, str | None] = {}
    current: str | None = None
    pattern = re.compile(
        r"\b(?:ALTER TABLE|UPDATE|INSERT INTO|FROM|JOIN|DELETE FROM)\s+core\.([a-z_]+)\b",
        re.IGNORECASE,
    )
    for idx, line in enumerate(lines, start=1):
        m = pattern.search(line)
        if m:
            current = str(m.group(1)).strip().lower()
        table_by_line[idx] = current
    return table_by_line


def classify_hit(row: dict[str, str], table_contexts: dict[str, dict[int, str | None]]) -> str:
    archivo = str(row.get("archivo") or "")
    snippet = str(row.get("snippet") or "").strip().lower()
    tabla_raw = str(row.get("tabla") or "").strip().lower()
    tablas = {t.strip().lower() for t in tabla_raw.split("|") if t.strip()}
    line_no = int(row.get("linea") or 0)
    ctx_table = (table_contexts.get(archivo) or {}).get(line_no)

    # Si la coincidencia no corresponde a la tabla SQL de contexto, es falso positivo.
    if tablas and ctx_table and ctx_table not in tablas:
        return "LOW"

    # CRITICAL: mutaciones SQL que impactan esquema/datos en runtime productivo.
    if archivo.endswith("/backend/main.py"):
        critical_tokens = (
            "add column if not exists",
            "alter column",
            "set cp =",
            "estado = coalesce",
            "set motivo =",
            "diagnostico =",
            "regexp_split_to_table(coalesce(c.tipo_consulta",
            "position('primera_vez_en_clinica'",
            "tipo_consulta = %s",
            "motivo = %s",
            "diagnostico = %s",
            "plan = null",
            "codigo_postal = %s",
            "estado_direccion = %s",
        )
        if any(tok in snippet for tok in critical_tokens):
            return "CRITICAL"

        # MEDIUM: referencias runtime de compatibilidad (lecturas, mapeos, payloads).
        if (
            "select " in snippet
            or "from core." in snippet
            or "where " in snippet
            or "coalesce(" in snippet
            or "returning" in snippet
            or "normalize_" in snippet
        ):
            return "MEDIUM"
        return "MEDIUM"

    # Frontend
    low_tokens = (
        "className=".lower(),
        "style=",
        "aria-label",
        "ver historia",
        "crear historia",
        "historia clínica",
        "data-hist-section",
    )
    if any(tok in snippet for tok in low_tokens):
        return "LOW"
    if snippet.startswith("//") or snippet.startswith("/*") or snippet.startswith("*"):
        return "LOW"
    return "MEDIUM"


def write_classified_report(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["severidad", "archivo", "tabla", "columna", "linea", "snippet"],
        )
        w.writeheader()
        w.writerows(rows)


def write_hits_summary(path: Path, rows: list[dict[str, str]]) -> None:
    counts = Counter((r["archivo"], r["tabla"], r["columna"]) for r in rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["archivo", "tabla", "columna", "conteo"])
        for (archivo, tabla, columna), count in sorted(
            counts.items(),
            key=lambda item: (-item[1], item[0][2], item[0][0]),
        ):
            w.writerow([archivo, tabla, columna, count])


def main() -> int:
    p = argparse.ArgumentParser(description="Smoke test pre-borrado de columnas legacy (sin aplicar migración).")
    p.add_argument("--project-root", default="/Users/alejandromoncadag/opticaolm")
    p.add_argument("--anio", type=int, default=2026)
    p.add_argument("--output-dir", default="/Users/alejandromoncadag/opticaolm/exports/csv")
    p.add_argument("--skip-build", action="store_true", help="No compilar backend/frontend")
    args = p.parse_args()

    project_root = Path(args.project_root)
    backend_dir = project_root / "backend"
    frontend_dir = project_root / "frontend"
    output_dir = Path(args.output_dir)
    catalog_dir = output_dir / "catalogos" / str(args.anio)

    if not args.skip_build:
        run([str(project_root / ".venv" / "bin" / "python"), "-m", "py_compile", "main.py"], cwd=backend_dir)
        run(["npm", "run", "build"], cwd=frontend_dir)

    run(
        [
            str(project_root / ".venv" / "bin" / "python"),
            str(backend_dir / "scripts" / "export_csv_sucursal_anio.py"),
            "--anio",
            str(args.anio),
            "--output-dir",
            str(output_dir),
        ]
    )

    run(
        [
            str(project_root / ".venv" / "bin" / "python"),
            str(backend_dir / "scripts" / "verificar_export_canonic_vs_fisico.py"),
            "--output-dir",
            str(output_dir),
            "--anio",
            str(args.anio),
        ]
    )

    legacy_csv = catalog_dir / "columnas_legacy_no_canonicas.csv"
    if not legacy_csv.exists():
        print(f"ERROR: no existe {legacy_csv}")
        return 2

    targets = load_legacy_targets(legacy_csv)
    if not targets:
        print("Sin columnas legacy listadas.")
        return 0

    columns_set = {col for _, col in targets}
    table_by_col: dict[str, set[str]] = {}
    for t, c in targets:
        table_by_col.setdefault(c, set()).add(t)

    runtime_files = [
        backend_dir / "main.py",
        frontend_dir / "src" / "App.tsx",
    ]

    report_rows: list[dict[str, str]] = []
    total_hits = 0
    table_contexts: dict[str, dict[int, str | None]] = {}
    for file_path in runtime_files:
        if not file_path.exists():
            continue
        table_contexts[str(file_path)] = build_table_context(file_path)
        hits = scan_file_for_columns(file_path, columns_set)
        total_hits += len(hits)
        for col, line_no, snippet in hits:
            report_rows.append(
                {
                    "archivo": str(file_path),
                    "tabla": "|".join(sorted(table_by_col.get(col, {"?"}))),
                    "columna": col,
                    "linea": str(line_no),
                    "snippet": snippet,
                }
            )

    report_path = catalog_dir / "legacy_referencias_runtime.csv"
    write_hits_report(report_path, report_rows)
    summary_path = catalog_dir / "legacy_referencias_runtime_resumen.csv"
    write_hits_summary(summary_path, report_rows)
    classified_rows = [
        {
            "severidad": classify_hit(r, table_contexts),
            "archivo": r["archivo"],
            "tabla": r["tabla"],
            "columna": r["columna"],
            "linea": r["linea"],
            "snippet": r["snippet"],
        }
        for r in report_rows
    ]
    classified_path = catalog_dir / "legacy_referencias_runtime_clasificadas.csv"
    write_classified_report(classified_path, classified_rows)
    sev_counter = Counter(r["severidad"] for r in classified_rows)

    critical_rows = [r for r in classified_rows if r["severidad"] == "CRITICAL"]
    top_critical_path = catalog_dir / "legacy_top20_critical.csv"
    top_critical = sorted(
        critical_rows,
        key=lambda r: (r["archivo"], int(r["linea"]), r["columna"]),
    )[:20]
    write_classified_report(top_critical_path, top_critical)

    print(f"\nReporte de referencias runtime: {report_path}")
    print(f"Resumen de referencias runtime: {summary_path}")
    print(f"Clasificación severidad: {classified_path}")
    print(f"Top 20 CRITICAL: {top_critical_path}")
    print(f"Total referencias encontradas: {total_hits}")
    print(f"CRITICAL={sev_counter.get('CRITICAL', 0)} | MEDIUM={sev_counter.get('MEDIUM', 0)} | LOW={sev_counter.get('LOW', 0)}")

    if sev_counter.get("CRITICAL", 0) > 0:
        print("\nRESULTADO: FAIL (aún hay referencias CRITICAL a columnas legacy).")
        return 3

    print("\nRESULTADO: OK (sin referencias CRITICAL a columnas legacy).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
