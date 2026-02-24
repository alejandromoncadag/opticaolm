#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import psycopg


DEFAULT_CONNINFO = "host=localhost port=5432 dbname=eyecare user=alejandromoncadag"


@dataclass(frozen=True)
class ExportQuery:
    filename: str
    sql: str

HISTORIAS_CANONICAL_COLUMNS = [
    "historia_id", "paciente_id", "sucursal_id",
    "doctor_atencion", "puesto_laboral",
    "diagnostico_general",
    "diagnostico_principal", "diagnostico_principal_otro",
    "diagnosticos_secundarios", "diagnosticos_secundarios_otro",
    "recomendacion_tratamiento",
    "seguimiento_requerido", "seguimiento_tipo", "seguimiento_valor",
    "antecedentes_generales", "antecedentes_otro",
    "antecedentes_oculares_familiares", "antecedentes_oculares_familiares_otro",
    "alergias", "enfermedades", "cirugias",
    "diabetes_estado", "diabetes_control", "diabetes_anios", "diabetes_tratamiento",
    "horas_pantalla_dia", "conduccion_nocturna_horas", "exposicion_uv",
    "tabaquismo_estado", "tabaquismo_intensidad", "tabaquismo_anios", "tabaquismo_anios_desde_dejo",
    "alcohol_frecuencia",
    "marihuana_frecuencia", "marihuana_forma",
    "drogas_consumo", "drogas_tipos", "drogas_frecuencia",
    "deporte_frecuencia", "deporte_duracion", "deporte_tipos",
    "hipertension",
    "medicamentos",
    "usa_lentes", "tipo_lentes_actual", "tiempo_uso_lentes", "lentes_contacto_horas_dia",
    "uso_lentes_proteccion_uv", "uso_lentes_sol_frecuencia",
    "fotofobia_escala", "dolor_ocular_escala", "cefalea_frecuencia",
    "trabajo_cerca_horas_dia", "distancia_promedio_pantalla_cm", "iluminacion_trabajo",
    "flotadores_destellos", "flotadores_inicio_reciente", "flotadores_lateralidad",
    "horas_exterior_dia", "nivel_educativo", "horas_lectura_dia",
    "horas_sueno_promedio", "estres_nivel", "peso_kg", "altura_cm",
    "sintomas_al_despertar", "sintomas_al_despertar_otro",
    "convive_mascotas", "convive_mascotas_otro",
    "uso_aire_acondicionado_frecuencia", "uso_aire_acondicionado_horas_dia",
    "uso_calefaccion_frecuencia", "uso_calefaccion_horas_dia",
    "uso_pantalla_en_oscuridad", "cafeina_por_dia",
    "sintomas",
    "od_esfera", "od_cilindro", "od_eje", "od_add",
    "oi_esfera", "oi_cilindro", "oi_eje", "oi_add",
    "dp", "queratometria_od", "queratometria_oi", "presion_od", "presion_oi",
    "ppc", "lejos", "cerca", "tension", "mmhg", "di",
    "avsinrxod", "avsinrixoi", "capvisualod", "capvisualoi", "avrxantod", "avrxantoi",
    "queraod", "queraoi", "retinosod", "retinosoi", "subjeod", "subjeoi",
    "papila", "adicionod", "adicionoi",
    "biomicroscopia",
    "created_by", "created_at_tz", "updated_at", "activo",
]


def normalize_controlled_token(value: str | None) -> str | None:
    if value is None:
        return None
    v = str(value).strip().lower()
    if not v:
        return None
    v = re.sub(r"\s+", "_", v)
    v = re.sub(r"_+", "_", v)
    return v


def split_pipe_values(value: str | None) -> list[str]:
    if not value:
        return []
    return [x.strip() for x in str(value).split("|") if x and x.strip()]


def _active_clause(alias: str, include_inactive: bool) -> str:
    if include_inactive:
        return ""
    return f"AND {alias}.activo = true"


def build_queries(include_inactive: bool) -> list[ExportQuery]:
    p_active = _active_clause("p", include_inactive)
    c_active = _active_clause("c", include_inactive)
    v_active = _active_clause("v", include_inactive)
    h_active = _active_clause("h", include_inactive)
    historias_select = ",\n                  ".join([f"h.{c}" for c in HISTORIAS_CANONICAL_COLUMNS])

    return [
        ExportQuery(
            filename="pacientes.csv",
            sql=f"""
                SELECT
                  p.paciente_id,
                  p.sucursal_id,
                  p.primer_nombre,
                  p.segundo_nombre,
                  p.apellido_paterno,
                  p.apellido_materno,
                  p.fecha_nacimiento,
                  p.sexo,
                  p.telefono,
                  p.correo,
                  p.creado_en,
                  p.actualizado_en,
                  p.activo,
                  p.como_nos_conocio,
                  p.calle,
                  p.numero,
                  p.colonia,
                  COALESCE(NULLIF(p.codigo_postal, ''), NULLIF(p.cp, '')) AS cp,
                  p.municipio,
                  COALESCE(NULLIF(p.estado_direccion, ''), NULLIF(p.estado, '')) AS estado,
                  p.pais
                FROM core.pacientes p
                WHERE p.sucursal_id = %(sucursal_id)s
                  AND EXTRACT(YEAR FROM p.creado_en) = %(anio)s
                  {p_active}
                ORDER BY p.creado_en ASC, p.paciente_id ASC;
            """,
        ),
        ExportQuery(
            filename="consultas.csv",
            sql=f"""
                SELECT
                  c.consulta_id,
                  c.paciente_id,
                  c.sucursal_id,
                  c.fecha_hora,
                  c.etapa_consulta,
                  c.motivo_consulta,
                  c.doctor_primer_nombre,
                  c.doctor_apellido_paterno,
                  c.notas,
                  c.agenda_event_id,
                  c.agenda_inicio,
                  c.agenda_fin
                FROM core.consultas c
                WHERE c.sucursal_id = %(sucursal_id)s
                  AND EXTRACT(YEAR FROM c.fecha_hora) = %(anio)s
                  {c_active}
                ORDER BY c.fecha_hora ASC, c.consulta_id ASC;
            """,
        ),
        ExportQuery(
            filename="ventas.csv",
            sql=f"""
                SELECT
                  v.venta_id,
                  v.sucursal_id,
                  v.paciente_id,
                  v.fecha_hora,
                  v.compra,
                  v.monto_total,
                  v.metodo_pago,
                  v.adelanto_aplica,
                  v.adelanto_monto,
                  v.adelanto_metodo,
                  v.notas,
                  v.created_by,
                  v.updated_at,
                  v.activo
                FROM core.ventas v
                WHERE v.sucursal_id = %(sucursal_id)s
                  AND EXTRACT(YEAR FROM v.fecha_hora) = %(anio)s
                  {v_active}
                ORDER BY v.fecha_hora ASC, v.venta_id ASC;
            """,
        ),
        ExportQuery(
            filename="historias_clinicas.csv",
            sql=f"""
                SELECT
                  {historias_select}
                FROM core.historias_clinicas h
                WHERE h.sucursal_id = %(sucursal_id)s
                  AND EXTRACT(YEAR FROM h.created_at_tz) = %(anio)s
                  {h_active}
                ORDER BY h.created_at_tz ASC, h.historia_id ASC;
            """,
        ),
    ]


def fetch_sucursales(conn: psycopg.Connection[Any], only_id: int | None) -> list[tuple[int, str]]:
    with conn.cursor() as cur:
        if only_id is not None:
            cur.execute(
                """
                SELECT sucursal_id, nombre
                FROM core.sucursales
                WHERE sucursal_id = %s
                ORDER BY sucursal_id;
                """,
                (only_id,),
            )
        else:
            cur.execute(
                """
                SELECT sucursal_id, nombre
                FROM core.sucursales
                ORDER BY sucursal_id;
                """
            )
        rows = cur.fetchall()
    return [(int(r[0]), str(r[1])) for r in rows]


def write_csv(path: Path, columns: list[str], rows: list[tuple[Any, ...]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        for row in rows:
            writer.writerow(list(row))


def drop_columns(
    columns: list[str],
    rows: list[tuple[Any, ...]],
    to_drop: set[str],
) -> tuple[list[str], list[tuple[Any, ...]]]:
    keep_idx = [i for i, c in enumerate(columns) if c not in to_drop]
    next_cols = [columns[i] for i in keep_idx]
    next_rows = [tuple(row[i] for i in keep_idx) for row in rows]
    return next_cols, next_rows


def export_catalogs(conn: psycopg.Connection[Any], output_root: Path, anio: int) -> dict[str, Any]:
    catalog_dir = output_root / "catalogos" / str(anio)
    catalog_dir.mkdir(parents=True, exist_ok=True)
    out: dict[str, Any] = {"files": {}}
    legacy_dict = catalog_dir / "diccionario_columnas.csv"
    if legacy_dict.exists():
        legacy_dict.unlink()

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT sucursal_id, nombre, codigo, ciudad, estado, activa, creado_en
            FROM core.sucursales
            ORDER BY sucursal_id;
            """
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
    p1 = catalog_dir / "sucursales.csv"
    write_csv(p1, cols, rows)
    out["files"]["sucursales.csv"] = {"rows": len(rows), "columns": cols, "path": str(p1)}

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT table_name, column_name, data_type, is_nullable, ordinal_position
            FROM information_schema.columns
            WHERE table_schema = 'core'
              AND table_name IN ('pacientes', 'consultas', 'ventas', 'historias_clinicas', 'sucursales')
            ORDER BY table_name, ordinal_position;
            """
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
    p2 = catalog_dir / "diccionario_modelo_completo.csv"
    write_csv(p2, cols, rows)
    out["files"]["diccionario_modelo_completo.csv"] = {"rows": len(rows), "columns": cols, "path": str(p2)}

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT table_name, column_name, data_type, is_nullable, ordinal_position
            FROM information_schema.columns
            WHERE table_schema = 'core'
            ORDER BY table_name, ordinal_position;
            """
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
    p3 = catalog_dir / "diccionario_columnas_fisico.csv"
    write_csv(p3, cols, rows)
    out["files"]["diccionario_columnas_fisico.csv"] = {"rows": len(rows), "columns": cols, "path": str(p3)}

    return out


def export_for_sucursal(
    conn: psycopg.Connection[Any],
    sucursal_id: int,
    sucursal_nombre: str,
    anio: int,
    output_root: Path,
    include_inactive: bool,
) -> dict[str, Any]:
    normalized = (
        unicodedata.normalize("NFKD", sucursal_nombre).encode("ascii", "ignore").decode("ascii").lower()
    )
    safe_name = "".join(ch if ch.isalnum() else "_" for ch in normalized).strip("_")
    folder = output_root / f"sucursal_{sucursal_id}_{safe_name}" / str(anio)
    folder.mkdir(parents=True, exist_ok=True)

    summary: dict[str, Any] = {
        "sucursal_id": sucursal_id,
        "sucursal_nombre": sucursal_nombre,
        "anio": anio,
        "include_inactive": include_inactive,
        "files": {},
    }

    for export_query in build_queries(include_inactive):
        with conn.cursor() as cur:
            cur.execute(
                export_query.sql,
                {"sucursal_id": sucursal_id, "anio": anio},
            )
            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]

        out_path = folder / export_query.filename
        write_csv(out_path, columns, rows)
        summary["files"][export_query.filename] = {
            "rows": len(rows),
            "columns": columns,
            "path": str(out_path),
        }

    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Exporta CSV por sucursal y año (pacientes, consultas, ventas, historias clínicas)."
    )
    parser.add_argument("--anio", type=int, default=2026, help="Año a exportar. Ejemplo: 2026")
    parser.add_argument("--sucursal-id", type=int, default=None, help="Sucursal específica. Si no se envía, exporta todas.")
    parser.add_argument(
        "--output-dir",
        type=str,
        default="/Users/alejandromoncadag/opticaolm/exports/csv",
        help="Directorio raíz de salida para los CSV.",
    )
    parser.add_argument(
        "--include-inactive",
        action="store_true",
        help="Incluye registros inactivos (soft-delete). Por defecto exporta solo activos.",
    )
    parser.add_argument(
        "--conninfo",
        type=str,
        default=os.getenv("DB_CONNINFO", DEFAULT_CONNINFO),
        help="Cadena de conexión Postgres.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_root = Path(args.output_dir)
    output_root.mkdir(parents=True, exist_ok=True)

    started_at = datetime.now().isoformat(timespec="seconds")
    full_summary: dict[str, Any] = {
        "started_at": started_at,
        "anio": args.anio,
        "sucursal_id_filter": args.sucursal_id,
        "include_inactive": bool(args.include_inactive),
        "exports": [],
    }

    with psycopg.connect(args.conninfo) as conn:
        sucursales = fetch_sucursales(conn, args.sucursal_id)
        if not sucursales:
            raise SystemExit("No se encontraron sucursales para exportar.")

        full_summary["catalogos"] = export_catalogs(conn, output_root, args.anio)

        for sucursal_id, sucursal_nombre in sucursales:
            summary = export_for_sucursal(
                conn=conn,
                sucursal_id=sucursal_id,
                sucursal_nombre=sucursal_nombre,
                anio=args.anio,
                output_root=output_root,
                include_inactive=bool(args.include_inactive),
            )
            full_summary["exports"].append(summary)

    summary_path = output_root / f"resumen_export_{args.anio}.json"
    with summary_path.open("w", encoding="utf-8") as f:
        json.dump(full_summary, f, ensure_ascii=False, indent=2)

    print(f"Exportación completada. Resumen: {summary_path}")
    for item in full_summary["exports"]:
        sid = item["sucursal_id"]
        sname = item["sucursal_nombre"]
        print(f"- Sucursal {sid} ({sname})")
        for filename, meta in item["files"].items():
            print(f"  - {filename}: {meta['rows']} filas")


if __name__ == "__main__":
    main()
