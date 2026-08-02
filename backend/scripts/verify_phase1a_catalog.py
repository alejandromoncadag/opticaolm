#!/usr/bin/env python3
"""Read-only Phase 1A database and media verification."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from typing import Any

from psycopg import sql


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
OLM_GLASSES_DIR = Path(r"C:\Users\aleja\projects\olm-glasses")
MEDIA_DIR = BACKEND_DIR / "media" / "products" / "olm-glasses"

PHASE1A_TABLES = (
    "catalogo_productos",
    "catalogo_inventario_sucursal",
    "catalogo_producto_imagenes",
    "catalogo_producto_variantes",
)

LEGACY_TABLES = (
    "productos",
    "ventas",
    "venta_detalles",
    "venta_pagos",
    "inventario_movimientos",
)

EXPECTED_PRODUCTS: dict[str, tuple[Any, ...]] = {
    "DEMO-RX-001": (
        "lentes_opticos", "armazon", "producto_fisico", "precio_base",
        "1499.00", True, "inventario", "pieza",
    ),
    "DEMO-SUN-001": (
        "lentes_de_sol", "armazon", "producto_fisico", "precio_base",
        "1599.00", True, "inventario", "pieza",
    ),
    "DEMO-LC-001": (
        "lentes_de_contacto", "caja", "producto_fisico", "precio_base",
        "899.00", True, "inventario", "caja",
    ),
    "DEMO-ACC-001": (
        "accesorios_y_refacciones", "estuche", "producto_fisico",
        "precio_base", "349.00", True, "inventario", "pieza",
    ),
    "DEMO-CARE-001": (
        "soluciones_y_cuidado", "limpieza", "producto_fisico",
        "precio_base", "189.00", True, "inventario", "pieza",
    ),
    "DEMO-SVC-EYE-001": (
        "examen_de_la_vista", "servicio", "servicio", "precio_base",
        "350.00", False, "servicio", "servicio",
    ),
    "DEMO-LENS-MONO": (
        "micas", "diseno", "componente_mica", "ajuste_venta", "0.00",
        False, "laboratorio_bajo_pedido", "par",
    ),
    "DEMO-LENS-BIFO": (
        "micas", "diseno", "componente_mica", "ajuste_venta", "900.00",
        False, "laboratorio_bajo_pedido", "par",
    ),
    "DEMO-LENS-PROG": (
        "micas", "diseno", "componente_mica", "ajuste_venta", "2200.00",
        False, "laboratorio_bajo_pedido", "par",
    ),
    "DEMO-LENS-NONRX": (
        "micas", "diseno", "componente_mica", "ajuste_venta", "0.00",
        False, "laboratorio_bajo_pedido", "par",
    ),
    "DEMO-TRT-AR": (
        "micas", "tratamiento", "componente_mica", "ajuste_venta",
        "500.00", False, "laboratorio_bajo_pedido", "aplicacion_por_par",
    ),
    "DEMO-TRT-PHOTO": (
        "micas", "tratamiento", "componente_mica", "ajuste_venta",
        "1000.00", False, "laboratorio_bajo_pedido", "aplicacion_por_par",
    ),
    "DEMO-TRT-BLUE": (
        "micas", "tratamiento", "componente_mica", "ajuste_venta",
        "1500.00", False, "laboratorio_bajo_pedido", "aplicacion_por_par",
    ),
    "DEMO-TRT-TINT": (
        "micas", "tratamiento", "componente_mica", "ajuste_venta",
        "1000.00", False, "laboratorio_bajo_pedido", "aplicacion_por_par",
    ),
}

EXPECTED_VARIANTS = {
    ("DEMO-TRT-BLUE", "reflejo_verde", "Reflejo verde", 10),
    ("DEMO-TRT-BLUE", "reflejo_azul", "Reflejo azul", 20),
    ("DEMO-TRT-TINT", "gris", "Gris", 10),
    ("DEMO-TRT-TINT", "cafe", "Café", 20),
    ("DEMO-TRT-TINT", "verde", "Verde", 30),
    ("DEMO-TRT-TINT", "azul", "Azul", 40),
    ("DEMO-TRT-TINT", "rosa", "Rosa", 50),
    ("DEMO-TRT-TINT", "ambar", "Ámbar", 60),
    ("DEMO-TRT-TINT", "vino", "Vino", 70),
    ("DEMO-TRT-TINT", "morado", "Morado", 80),
    ("DEMO-TRT-TINT", "negro", "Negro", 90),
    ("DEMO-TRT-TINT", "naranja", "Naranja", 100),
}

EXPECTED_MEDIA = {
    "DEMO-RX-001": {
        "source": "public/products/olm/modelo-clasico.webp",
        "destination": "olm/modelo-clasico.webp",
        "url": "/media/products/olm-glasses/olm/modelo-clasico.webp",
        "mime": "image/webp", "width": 1600, "height": 1200,
        "bytes": 36386,
        "sha256": "f93d60d06ccd03eba621094df3dc4b66041b5b7f166e823c0a7be6d43ee7c03e",
    },
    "DEMO-SUN-001": {
        "source": "public/products/olm/sol-clasico.webp",
        "destination": "olm/sol-clasico.webp",
        "url": "/media/products/olm-glasses/olm/sol-clasico.webp",
        "mime": "image/webp", "width": 1600, "height": 1200,
        "bytes": 36872,
        "sha256": "975b4c6f5d4381e2163b94d27bba48a37a5ef9307f56d1aa4e4e5d232f8e4104",
    },
    "DEMO-LC-001": {
        "source": "public/products/contacts/luma-daily.webp",
        "destination": "contacts/luma-daily.webp",
        "url": "/media/products/olm-glasses/contacts/luma-daily.webp",
        "mime": "image/webp", "width": 1600, "height": 854,
        "bytes": 33580,
        "sha256": "ebc81c599e3b0bd0c6138504492db7301121b3ada626d2b61429098b4a3f4b22",
    },
    "DEMO-ACC-001": {
        "source": "public/products/accessories/estuche-espresso.webp",
        "destination": "accessories/estuche-espresso.webp",
        "url": "/media/products/olm-glasses/accessories/estuche-espresso.webp",
        "mime": "image/webp", "width": 1536, "height": 1024,
        "bytes": 55420,
        "sha256": "2c161cb2ac081ac5a1212d492115435c34e0e83356806fbb874db77be30b2cd3",
    },
    "DEMO-CARE-001": {
        "source": "public/products/accessories/spray-limpiador.webp",
        "destination": "accessories/spray-limpiador.webp",
        "url": "/media/products/olm-glasses/accessories/spray-limpiador.webp",
        "mime": "image/webp", "width": 1536, "height": 1024,
        "bytes": 28204,
        "sha256": "cd6553e161df4ade985c2cc8aa46dbbf1df98b885d64734ebe46c277b93de1e6",
    },
    "DEMO-SVC-EYE-001": {
        "source": "public/images/eye-exam/adult-patient.png",
        "destination": "eye-exam/adult-patient.png",
        "url": "/media/products/olm-glasses/eye-exam/adult-patient.png",
        "mime": "image/png", "width": 1254, "height": 1254,
        "bytes": 2373672,
        "sha256": "1c494a3d891d879289e63f0692be68f2dd167c562bee13a8b4074135d2ea5668",
    },
}


class VerificationError(RuntimeError):
    pass


def _json_hash(value: Any) -> str:
    payload = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        default=str,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _table_exists(cur, table_name: str) -> bool:
    cur.execute("SELECT to_regclass(%s) IS NOT NULL", (f"core.{table_name}",))
    return bool(cur.fetchone()[0])


def fingerprint_table(cur, table_name: str) -> dict[str, Any]:
    if not _table_exists(cur, table_name):
        raise VerificationError(f"Missing legacy table: core.{table_name}")

    cur.execute(
        """
        SELECT ordinal_position, column_name, data_type, udt_name, is_nullable,
               column_default
        FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = %s
        ORDER BY ordinal_position
        """,
        (table_name,),
    )
    columns = cur.fetchall()

    cur.execute(
        """
        SELECT conname, contype, pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE conrelid = to_regclass(%s)
        ORDER BY conname
        """,
        (f"core.{table_name}",),
    )
    constraints = cur.fetchall()

    cur.execute(
        """
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'core' AND tablename = %s
        ORDER BY indexname
        """,
        (table_name,),
    )
    indexes = cur.fetchall()

    cur.execute(
        """
        SELECT attribute_row.attname
        FROM pg_index index_row
        CROSS JOIN LATERAL unnest(index_row.indkey)
            WITH ORDINALITY AS key_row(attnum, key_order)
        JOIN pg_attribute attribute_row
          ON attribute_row.attrelid = index_row.indrelid
         AND attribute_row.attnum = key_row.attnum
        WHERE index_row.indrelid = to_regclass(%s)
          AND index_row.indisprimary
        ORDER BY key_row.key_order
        """,
        (f"core.{table_name}",),
    )
    primary_key = [row[0] for row in cur.fetchall()]
    if not primary_key:
        raise VerificationError(f"No primary key available for core.{table_name}")

    identifiers = [sql.Identifier(name) for name in primary_key]
    query = sql.SQL(
        "SELECT row_to_json(ordered_row)::text "
        "FROM (SELECT * FROM {}.{} ORDER BY {}) AS ordered_row"
    ).format(
        sql.Identifier("core"),
        sql.Identifier(table_name),
        sql.SQL(", ").join(identifiers),
    )
    cur.execute(query)
    row_payloads = [row[0] for row in cur.fetchall()]

    return {
        "rows": len(row_payloads),
        "data_sha256": _json_hash(row_payloads),
        "schema_sha256": _json_hash(
            {
                "columns": columns,
                "constraints": constraints,
                "indexes": indexes,
            }
        ),
    }


def fingerprint_legacy_tables(cur) -> dict[str, dict[str, Any]]:
    return {name: fingerprint_table(cur, name) for name in LEGACY_TABLES}


def verify_catalog(cur) -> list[str]:
    errors: list[str] = []
    existing = [name for name in PHASE1A_TABLES if _table_exists(cur, name)]
    if existing != list(PHASE1A_TABLES):
        errors.append(
            "Phase 1A table set is incomplete: "
            + (", ".join(existing) if existing else "none")
        )
        raise VerificationError("; ".join(errors))

    cur.execute(
        """
        SELECT sku, categoria, subcategoria, tipo_producto, modalidad_precio,
               precio::text, controla_stock, comportamiento_abasto_default,
               unidad_medida, costo_unitario, costo_confirmado,
               publicado_online
        FROM core.catalogo_productos
        ORDER BY sku
        """
    )
    actual_products = {}
    for row in cur.fetchall():
        actual_products[row[0]] = tuple(row[1:9])
        if row[9] is not None or row[10] is not False or row[11] is not False:
            errors.append(f"Cost/publication invariant failed for {row[0]}")
    if actual_products != EXPECTED_PRODUCTS:
        errors.append("Product records differ from the approved Phase 1A set")

    cur.execute(
        """
        SELECT producto.sku, variante.codigo, variante.nombre, variante.orden,
               variante.precio_ajuste_override, variante.costo_unitario,
               variante.costo_confirmado
        FROM core.catalogo_producto_variantes variante
        JOIN core.catalogo_productos producto
          ON producto.producto_id = variante.producto_id
        ORDER BY producto.sku, variante.orden, variante.codigo
        """
    )
    actual_variants = set()
    for row in cur.fetchall():
        actual_variants.add(tuple(row[:4]))
        if row[4] is not None or row[5] is not None or row[6] is not False:
            errors.append(f"Variant cost invariant failed for {row[0]}/{row[1]}")
    if actual_variants != EXPECTED_VARIANTS:
        errors.append("Variant records differ from the approved Phase 1A set")

    cur.execute("SELECT sucursal_id FROM core.sucursales WHERE activa = true ORDER BY sucursal_id")
    active_branches = [int(row[0]) for row in cur.fetchall()]
    physical_skus = {
        sku for sku, values in EXPECTED_PRODUCTS.items() if values[5] is True
    }
    expected_inventory = {
        (sku, branch_id) for sku in physical_skus for branch_id in active_branches
    }
    cur.execute(
        """
        SELECT producto.sku, inventario.sucursal_id, inventario.stock,
               inventario.stock_reservado, inventario.stock_minimo,
               inventario.costo_promedio, inventario.version
        FROM core.catalogo_inventario_sucursal inventario
        JOIN core.catalogo_productos producto
          ON producto.producto_id = inventario.producto_id
        ORDER BY producto.sku, inventario.sucursal_id
        """
    )
    actual_inventory = set()
    for row in cur.fetchall():
        actual_inventory.add((row[0], int(row[1])))
        stock, reserved, minimum, average_cost, version = row[2:7]
        if stock < 0 or reserved < 0 or reserved > stock or minimum < 0 or version < 0:
            errors.append(f"Invalid branch inventory values for {row[0]}/{row[1]}")
        if average_cost is not None and average_cost < 0:
            errors.append(f"Invalid average cost for {row[0]}/{row[1]}")
    if actual_inventory != expected_inventory:
        errors.append("Branch inventory rows differ from the approved product/branch matrix")

    cur.execute(
        """
        SELECT producto.sku, imagen.url, imagen.mime_type, imagen.ancho,
               imagen.alto, imagen.tamano_bytes, btrim(imagen.sha256),
               imagen.es_principal, imagen.origen
        FROM core.catalogo_producto_imagenes imagen
        JOIN core.catalogo_productos producto
          ON producto.producto_id = imagen.producto_id
        ORDER BY producto.sku
        """
    )
    actual_images = {}
    for row in cur.fetchall():
        actual_images[row[0]] = {
            "url": row[1], "mime": row[2], "width": row[3],
            "height": row[4], "bytes": row[5], "sha256": row[6],
        }
        if row[7] is not True or row[8] != "olm_glasses":
            errors.append(f"Primary/source image invariant failed for {row[0]}")
    expected_images = {
        sku: {
            key: data[key]
            for key in ("url", "mime", "width", "height", "bytes", "sha256")
        }
        for sku, data in EXPECTED_MEDIA.items()
    }
    if actual_images != expected_images:
        errors.append("Image metadata differs from the approved source manifest")

    cur.execute(
        """
        SELECT COUNT(*)
        FROM pg_constraint constraint_row
        JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
        JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
        WHERE schema_row.nspname = 'core'
          AND table_row.relname = ANY(%s)
          AND pg_get_constraintdef(constraint_row.oid) ILIKE '%%CASCADE%%'
        """,
        (list(PHASE1A_TABLES),),
    )
    if int(cur.fetchone()[0]) != 0:
        errors.append("A Phase 1A constraint contains a cascading action")

    if errors:
        raise VerificationError("; ".join(errors))

    return [
        "14 global demo/component records",
        "12 approved variants",
        f"{len(expected_inventory)} valid branch inventory rows",
        "6 URL-only image metadata records",
        "all costs NULL and all records unpublished",
        "no cascading foreign-key actions",
    ]


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_media(require_destination: bool) -> list[dict[str, Any]]:
    results = []
    for sku, manifest in EXPECTED_MEDIA.items():
        source = OLM_GLASSES_DIR / manifest["source"]
        destination = MEDIA_DIR / manifest["destination"]
        if not source.is_file():
            raise VerificationError(f"Missing source image for {sku}: {source}")
        source_hash = _file_sha256(source)
        if source_hash != manifest["sha256"] or source.stat().st_size != manifest["bytes"]:
            raise VerificationError(f"Source image changed for {sku}")

        destination_hash = None
        if destination.exists():
            if not destination.is_file():
                raise VerificationError(f"Destination is not a file for {sku}")
            destination_hash = _file_sha256(destination)
            if destination_hash != source_hash:
                raise VerificationError(f"Destination image conflict for {sku}")
            if destination.stat().st_size != source.stat().st_size:
                raise VerificationError(f"Destination image size conflict for {sku}")
        elif require_destination:
            raise VerificationError(f"Missing copied image for {sku}: {destination}")

        results.append(
            {
                "sku": sku,
                "source": str(source),
                "destination": str(destination),
                "source_sha256": source_hash,
                "destination_sha256": destination_hash,
                "bytes": source.stat().st_size,
            }
        )
    return results


def main() -> int:
    sys.path.insert(0, str(BACKEND_DIR))
    import main as backend_main
    import psycopg

    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute("SET TRANSACTION READ ONLY")
            checks = verify_catalog(cur)
            fingerprints = fingerprint_legacy_tables(cur)

    media = verify_media(require_destination=True)
    print("PHASE 1A DATABASE VERIFICATION: OK")
    for check in checks:
        print(f"  [OK] {check}")
    print("LEGACY TABLE FINGERPRINTS:")
    for name, fingerprint in fingerprints.items():
        print(
            f"  [OK] core.{name}: rows={fingerprint['rows']} "
            f"data={fingerprint['data_sha256']} "
            f"schema={fingerprint['schema_sha256']}"
        )
    print("MEDIA HASH VERIFICATION:")
    for item in media:
        print(
            f"  [OK] {item['sku']}: bytes={item['bytes']} "
            f"source={item['source_sha256']} "
            f"destination={item['destination_sha256']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
