#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Iterable


def _load_header(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8", newline="") as f:
        r = csv.reader(f)
        return next(r, [])


def _load_physical_dictionary(path: Path) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {}
    with path.open("r", encoding="utf-8", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            table = str(row.get("table_name") or "").strip()
            col = str(row.get("column_name") or "").strip()
            if not table or not col:
                continue
            out.setdefault(table, set()).add(col)
    return out


def _find_any_sucursal_dir(root: Path, anio: int) -> Path:
    candidates = sorted(root.glob(f"sucursal_*/{anio}"))
    if not candidates:
        raise SystemExit(f"No se encontraron carpetas sucursal_*/{anio} en {root}")
    return candidates[0]


def _print_diffs(label: str, missing_in_physical: Iterable[str], omitted_in_canonical: Iterable[str]) -> None:
    miss = list(sorted(set(missing_in_physical)))
    omit = list(sorted(set(omitted_in_canonical)))
    print(f"\n[{label}]")
    print("- missing_in_physical:", ", ".join(miss) if miss else "none")
    print("- omitted_in_canonical:", ", ".join(omit) if omit else "none")


def main() -> None:
    p = argparse.ArgumentParser(description="Verifica headers canónicos vs diccionario físico de Postgres.")
    p.add_argument("--output-dir", required=True, help="Directorio raíz de export (ej: /.../export_2026_csv)")
    p.add_argument("--anio", type=int, required=True, help="Año exportado")
    p.add_argument(
        "--fail-on-omitted",
        action="store_true",
        help="Falla también si hay columnas físicas no exportadas en canónico.",
    )
    args = p.parse_args()

    root = Path(args.output_dir)
    catalog_dir = root / "catalogos" / str(args.anio)
    dict_path = catalog_dir / "diccionario_columnas_fisico.csv"
    if not dict_path.exists():
        raise SystemExit(f"No existe diccionario físico: {dict_path}")

    physical = _load_physical_dictionary(dict_path)

    sucursal_dir = _find_any_sucursal_dir(root, args.anio)
    mapping = {
        "consultas.csv": "consultas",
        "ventas.csv": "ventas",
        "pacientes.csv": "pacientes",
        "historias_clinicas.csv": "historias_clinicas",
    }

    fatal_issues = 0
    warn_issues = 0

    for fname, table in mapping.items():
        file_path = sucursal_dir / fname
        if not file_path.exists():
            print(f"\n[{fname}] archivo no encontrado en {file_path}")
            fatal_issues += 1
            continue

        header = _load_header(file_path)
        table_cols = physical.get(table, set())
        if not table_cols:
            print(f"\n[{fname}] tabla '{table}' no existe en diccionario físico")
            fatal_issues += 1
            continue

        header_set = set(header)
        missing_in_physical = sorted(header_set - table_cols)
        omitted_in_canonical = sorted(table_cols - header_set)

        _print_diffs(fname, missing_in_physical, omitted_in_canonical)

        if missing_in_physical:
            fatal_issues += 1
        if omitted_in_canonical:
            warn_issues += 1
            if args.fail_on_omitted:
                fatal_issues += 1

    suc_file = catalog_dir / "sucursales.csv"
    if suc_file.exists():
        header = _load_header(suc_file)
        table_cols = physical.get("sucursales", set())
        missing_in_physical = sorted(set(header) - table_cols)
        omitted_in_canonical = sorted(table_cols - set(header))
        _print_diffs("sucursales.csv", missing_in_physical, omitted_in_canonical)
        if missing_in_physical:
            fatal_issues += 1
        if omitted_in_canonical:
            warn_issues += 1
            if args.fail_on_omitted:
                fatal_issues += 1
    else:
        print(f"\n[sucursales.csv] archivo no encontrado en {suc_file}")
        fatal_issues += 1

    print("\nResumen:")
    print(f"- fatal_issues: {fatal_issues}")
    print(f"- warnings(omitted): {warn_issues}")

    if fatal_issues > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
