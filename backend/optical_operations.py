"""Phase 1G-D internal operations queue for configured optical work.

The module is intentionally internal and payment-neutral. It creates no sale,
payment, clinical prescription, supplier invoice, payable, inventory movement,
or permanent stock deduction.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
import json
import os
from typing import Any, Callable, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
import psycopg
from psycopg.rows import dict_row


PRODUCTION_STATES = {
    "pendiente_requisitos", "listo_para_produccion", "enviado_laboratorio",
    "en_fabricacion", "recibido", "entregado", "cancelado",
}
TERMINAL_PRODUCTION_STATES = {"entregado", "cancelado"}


def phase1gd_enabled() -> bool:
    return os.getenv("PHASE_1GD_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}


def phase1gf_enabled() -> bool:
    configured = os.getenv("PHASE_1GF_ENABLED")
    if configured is None:
        return phase1gd_enabled()
    return configured.strip().lower() in {"1", "true", "yes", "on"}


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def _cost_source(cost: Decimal | None, confirmed: bool) -> str:
    if cost is None:
        return "ausente"
    return "catalogo_confirmado" if confirmed else "catalogo_no_confirmado"


def _system_event(
    cur,
    job_id: int,
    event_type: str,
    *,
    previous: dict[str, Any] | None = None,
    new: dict[str, Any] | None = None,
    notes: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    cur.execute(
        """
        INSERT INTO core.trabajo_optico_eventos
            (trabajo_id, evento_tipo, actor_tipo, estado_anterior,
             estado_nuevo, notas, metadata)
        VALUES (%s, %s, 'sistema', %s::jsonb, %s::jsonb, %s, %s::jsonb)
        ON CONFLICT DO NOTHING
        """,
        (job_id, event_type, _json(previous) if previous is not None else None,
         _json(new) if new is not None else None, notes, _json(metadata or {})),
    )


def create_job_for_online_draft(cur, draft_id: int) -> int | None:
    """Create exactly one queue job in the caller's draft transaction."""
    if not phase1gd_enabled():
        return None
    cur.execute(
        """
        SELECT draft.borrador_id, draft.borrador_public_id, draft.sucursal_id,
               draft.prescription_method, draft.prescription_status,
               draft.estado_pago, draft.total_configurado_snapshot, draft.moneda,
               config.uso_visual, config.snapshot_comercial,
               config.comportamiento_abasto_diseno_snapshot,
               frame.producto_id AS frame_id, frame.sku AS frame_sku,
               frame.nombre AS frame_name, frame.precio AS frame_price,
               frame.costo_unitario AS frame_cost,
               frame.costo_confirmado AS frame_cost_confirmed,
               frame.comportamiento_abasto_default AS frame_supply,
               design.producto_id AS design_id, design.sku AS design_sku,
               design.nombre AS design_name, design.precio AS design_price,
               design.costo_unitario AS design_cost,
               design.costo_confirmado AS design_cost_confirmed,
               design.comportamiento_abasto_default AS design_supply,
               treatment.producto_id AS treatment_id,
               treatment.sku AS treatment_sku,
               treatment.nombre AS treatment_name,
               treatment.precio AS treatment_price,
               treatment.costo_unitario AS treatment_cost,
               treatment.costo_confirmado AS treatment_cost_confirmed,
               treatment.comportamiento_abasto_default AS treatment_supply,
               variant.variante_id, variant.nombre AS variant_name,
               variant.precio_ajuste_override AS variant_price,
               variant.costo_unitario AS variant_cost,
               variant.costo_confirmado AS variant_cost_confirmed
        FROM core.online_borradores_opticos draft
        JOIN core.online_configuraciones_opticas_borrador config
          ON config.borrador_id = draft.borrador_id
        JOIN core.catalogo_productos frame
          ON frame.producto_id = config.armazon_producto_id
        JOIN core.catalogo_productos design
          ON design.producto_id = config.diseno_producto_id
        LEFT JOIN core.catalogo_productos treatment
          ON treatment.producto_id = config.tratamiento_producto_id
        LEFT JOIN core.catalogo_producto_variantes variant
          ON variant.variante_id = config.variante_id
        WHERE draft.borrador_id = %s
        FOR SHARE OF draft, config, frame, design
        """,
        (draft_id,),
    )
    source = cur.fetchone()
    if not source:
        raise RuntimeError("Cannot create an optical job without its complete source draft")

    lab_costs: list[Decimal | None] = [source["design_cost"]]
    treatment_cost = None
    treatment_confirmed = False
    if source["treatment_id"] is not None:
        if source["variante_id"] is not None:
            treatment_cost = source["variant_cost"]
            treatment_confirmed = bool(source["variant_cost_confirmed"])
        else:
            treatment_cost = source["treatment_cost"]
            treatment_confirmed = bool(source["treatment_cost_confirmed"])
        lab_costs.append(treatment_cost)
    present_costs = [Decimal(value) for value in lab_costs if value is not None]
    estimate = sum(present_costs, Decimal("0.00")) if present_costs else None
    complete = all(value is not None for value in lab_costs)
    cost_state = "estimado" if complete else "estimado_parcial" if present_costs else "sin_estimar"

    cur.execute(
        """
        INSERT INTO core.trabajos_opticos
            (origen, online_borrador_id, sucursal_id,
             referencia_origen_snapshot, comportamiento_abasto, uso_visual,
             metodo_receta, requiere_receta, estado_receta, estado_pago,
             monto_pagado_confirmado, estado_costo_laboratorio,
             estado_produccion, moneda, precio_venta_snapshot,
             costo_armazon_snapshot, costo_laboratorio_estimado_snapshot,
             estimacion_costo_completa, configuracion_snapshot)
        VALUES
            ('pedido_online', %s, %s, %s, %s, %s, %s, TRUE,
             'pendiente', 'sin_pago', 0, %s, 'pendiente_requisitos',
             %s, %s, %s, %s, %s, %s::jsonb)
        ON CONFLICT (online_borrador_id) WHERE online_borrador_id IS NOT NULL
        DO NOTHING
        RETURNING trabajo_id
        """,
        (draft_id, source["sucursal_id"], str(source["borrador_public_id"]),
         source["comportamiento_abasto_diseno_snapshot"], source["uso_visual"],
         source["prescription_method"], cost_state, source["moneda"],
         source["total_configurado_snapshot"], source["frame_cost"], estimate,
         complete, _json(source["snapshot_comercial"])),
    )
    inserted = cur.fetchone()
    if not inserted:
        cur.execute("SELECT trabajo_id FROM core.trabajos_opticos WHERE online_borrador_id = %s", (draft_id,))
        return int(cur.fetchone()["trabajo_id"])
    job_id = int(inserted["trabajo_id"])

    components = [
        ("armazon", source["frame_id"], None, source["frame_sku"], source["frame_name"],
         None, source["frame_supply"], source["frame_price"], source["frame_cost"],
         _cost_source(source["frame_cost"], bool(source["frame_cost_confirmed"])), False),
        ("diseno", source["design_id"], None, source["design_sku"], source["design_name"],
         None, source["design_supply"], source["design_price"], source["design_cost"],
         _cost_source(source["design_cost"], bool(source["design_cost_confirmed"])), True),
    ]
    if source["treatment_id"] is not None:
        components.append(
            ("tratamiento", source["treatment_id"], source["variante_id"],
             source["treatment_sku"], source["treatment_name"], source["variant_name"],
             source["treatment_supply"],
             source["variant_price"] if source["variant_price"] is not None else source["treatment_price"],
             treatment_cost, _cost_source(treatment_cost, treatment_confirmed), True)
        )
    cur.executemany(
        """
        INSERT INTO core.trabajo_optico_componentes
            (trabajo_id, tipo_componente, producto_id, variante_id,
             sku_snapshot, nombre_snapshot, variante_snapshot,
             comportamiento_abasto_snapshot, precio_ajuste_snapshot,
             costo_estimado_snapshot, estado_fuente_costo,
             incluye_costo_laboratorio)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        [(job_id, *component) for component in components],
    )
    _system_event(cur, job_id, "trabajo_creado", new={
        "estadoProduccion": "pendiente_requisitos",
        "estadoReceta": "pendiente", "estadoPago": "sin_pago",
    }, metadata={"origen": "pedido_online", "referencia": str(source["borrador_public_id"])})
    return job_id


def cancel_job_for_online_draft(cur, draft_id: int, event_type: str) -> bool:
    """Cancel the mapped job idempotently in the caller's transaction."""
    if not phase1gd_enabled():
        return False
    cur.execute(
        """SELECT trabajo_id, estado_produccion, version
           FROM core.trabajos_opticos WHERE online_borrador_id = %s FOR UPDATE""",
        (draft_id,),
    )
    job = cur.fetchone()
    if not job or job["estado_produccion"] == "cancelado":
        return False
    cur.execute(
        """UPDATE core.trabajos_opticos
           SET estado_produccion = 'cancelado', cancelado_at = NOW(),
               updated_at = NOW(), version = version + 1
           WHERE trabajo_id = %s""",
        (job["trabajo_id"],),
    )
    _system_event(
        cur, int(job["trabajo_id"]), event_type,
        previous={"estadoProduccion": job["estado_produccion"]},
        new={"estadoProduccion": "cancelado"},
    )
    return True


PHYSICAL_ADVANCED_STATES = {
    "enviado_laboratorio", "en_fabricacion", "recibido", "entregado",
}


def _dict_row(cur, row: Any) -> dict[str, Any] | None:
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    return {column.name: row[index] for index, column in enumerate(cur.description)}


def _dict_rows(cur) -> list[dict[str, Any]]:
    return [_dict_row(cur, row) for row in cur.fetchall()]


def _physical_event(
    cur,
    job_id: int,
    event_type: str,
    *,
    username: str | None,
    previous: dict[str, Any] | None = None,
    new: dict[str, Any] | None = None,
    notes: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    staff = None
    if username:
        cur.execute(
            "SELECT usuario_id, username, rol FROM core.usuarios WHERE username=%s AND activo=TRUE",
            (username,),
        )
        staff = _dict_row(cur, cur.fetchone())
    if staff:
        cur.execute(
            """INSERT INTO core.trabajo_optico_eventos
               (trabajo_id, evento_tipo, actor_tipo, actor_usuario_id,
                actor_username_snapshot, actor_rol_snapshot, estado_anterior,
                estado_nuevo, notas, metadata)
               VALUES (%s,%s,'staff',%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s::jsonb)""",
            (job_id, event_type, staff["usuario_id"], staff["username"], staff["rol"],
             _json(previous) if previous is not None else None,
             _json(new) if new is not None else None, notes, _json(metadata or {})),
        )
    else:
        _system_event(
            cur, job_id, event_type, previous=previous, new=new,
            notes=notes, metadata=metadata,
        )


def _physical_structure(config: dict[str, Any]) -> tuple[Any, ...]:
    return (
        config.get("tipo_configuracion"), config.get("armazon_producto_id"),
        config.get("diseno_producto_id"), config.get("tratamiento_producto_id"),
        config.get("variante_id"),
    )


def validate_physical_structural_edit(
    cur, venta_id: int, new_configs: list[dict[str, Any]]
) -> None:
    """Reject structural changes after the shared job entered production."""
    if not phase1gf_enabled():
        return
    cur.execute(
        """SELECT config.configuracion_ref, config.tipo_configuracion,
                  config.armazon_producto_id, config.diseno_producto_id,
                  config.tratamiento_producto_id, config.variante_id,
                  job.estado_produccion
           FROM core.venta_configuraciones_opticas config
           JOIN core.trabajos_opticos job
             ON job.venta_configuracion_id=config.configuracion_id
           WHERE config.venta_id=%s AND config.estado_registro='activo'
           FOR UPDATE OF job""",
        (venta_id,),
    )
    existing = {row["configuracion_ref"]: row for row in _dict_rows(cur)}
    incoming = {item["configuracion_ref"]: item for item in new_configs}
    for reference, old in existing.items():
        if old["estado_produccion"] not in PHYSICAL_ADVANCED_STATES:
            continue
        candidate = incoming.get(reference)
        if candidate is None or _physical_structure(old) != _physical_structure(candidate):
            raise HTTPException(
                status_code=409,
                detail=(
                    f"La configuracion {reference} ya inicio produccion. "
                    "Cancela la configuracion desde la venta antes de cambiar "
                    "armazon, diseno, tratamiento o variante."
                ),
            )


def _physical_payment_state(amount: Decimal, total: Decimal, count: int, saved: str) -> str:
    if saved == "reembolsada":
        return "reembolsada"
    if amount <= 0:
        return "sin_pago"
    if amount >= total:
        return "pagada"
    return "anticipo" if count == 1 else "pago_parcial"


def _physical_source(cur, configuration_id: int) -> dict[str, Any]:
    cur.execute(
        """SELECT config.configuracion_id, config.venta_id,
                  config.configuracion_ref, config.tipo_configuracion,
                  config.armazon_producto_id, config.diseno_producto_id,
                  config.tratamiento_producto_id, config.variante_id,
                  config.uso_visual, config.uso_visual_otro,
                  config.prescripcion_id, config.comportamiento_abasto_usado,
                  config.estado_produccion AS estado_produccion_fisica,
                  config.estado_registro, config.precio_armazon_snapshot,
                  config.precio_diseno_snapshot,
                  config.precio_tratamiento_snapshot,
                  config.precio_variante_snapshot,
                  config.costo_armazon_snapshot, config.costo_diseno_snapshot,
                  config.costo_tratamiento_snapshot,
                  config.costo_variante_snapshot,
                  config.subtotal_bruto_snapshot,
                  sale.sucursal_id, sale.paciente_id, sale.monto_total,
                  sale.estado_venta, sale.estado_pago AS estado_pago_venta,
                  sale.activo AS venta_activa, design.sku AS diseno_sku,
                  EXISTS (
                    SELECT 1 FROM core.prescripciones_opticas rx
                    WHERE rx.prescripcion_id=config.prescripcion_id
                      AND rx.paciente_id=sale.paciente_id AND rx.activo=TRUE
                  ) AS prescripcion_valida
           FROM core.venta_configuraciones_opticas config
           JOIN core.ventas sale ON sale.venta_id=config.venta_id
           LEFT JOIN core.catalogo_productos design
             ON design.producto_id=config.diseno_producto_id
           WHERE config.configuracion_id=%s
           FOR SHARE OF config, sale""",
        (configuration_id,),
    )
    source = _dict_row(cur, cur.fetchone())
    if not source:
        raise RuntimeError("Physical optical configuration does not exist")
    cur.execute(
        """SELECT COALESCE(SUM(monto),0) AS amount, COUNT(*) AS count
           FROM core.venta_pagos WHERE venta_id=%s AND activo=TRUE""",
        (source["venta_id"],),
    )
    payment = _dict_row(cur, cur.fetchone())
    source["monto_pagado"] = Decimal(payment["amount"] or 0).quantize(Decimal("0.01"))
    source["cantidad_pagos"] = int(payment["count"] or 0)
    source["estado_pago_calculado"] = _physical_payment_state(
        source["monto_pagado"], Decimal(source["monto_total"] or 0),
        source["cantidad_pagos"], source["estado_pago_venta"],
    )
    optional = (
        source["tipo_configuracion"] == "solo_tratamiento"
        or source["uso_visual"] == "sin_graduacion"
        or source["diseno_sku"] == "DEMO-LENS-NONRX"
    )
    source["requiere_receta"] = not optional
    if optional:
        source["estado_receta_calculado"] = "no_requerida"
    elif source["prescripcion_id"] is not None and source["prescripcion_valida"]:
        source["estado_receta_calculado"] = "proporcionada"
    else:
        source["estado_receta_calculado"] = "pendiente"
    return source


def _physical_components(cur, configuration_id: int) -> list[dict[str, Any]]:
    cur.execute(
        """SELECT detail.tipo_linea, detail.producto_id, detail.variante_id,
                  detail.sku_snapshot, detail.nombre_snapshot,
                  variant.nombre AS variante_nombre_snapshot,
                  comportamiento_abasto_snapshot, precio_unitario_snapshot,
                  costo_unitario_snapshot
           FROM core.venta_catalogo_detalles detail
           LEFT JOIN core.catalogo_producto_variantes variant
             ON variant.variante_id=detail.variante_id
           WHERE detail.configuracion_id=%s AND detail.estado_registro='activo'
             AND detail.tipo_linea IN ('armazon','diseno','tratamiento')
           ORDER BY detail.venta_catalogo_detalle_id""",
        (configuration_id,),
    )
    return _dict_rows(cur)


def _physical_snapshot(source: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": "phase1gf.v1", "ventaId": source["venta_id"],
        "configuracionRef": source["configuracion_ref"],
        "tipoConfiguracion": source["tipo_configuracion"],
        "armazonProductoId": source["armazon_producto_id"],
        "disenoProductoId": source["diseno_producto_id"],
        "tratamientoProductoId": source["tratamiento_producto_id"],
        "varianteId": source["variante_id"], "usoVisual": source["uso_visual"],
        "usoVisualOtro": source["uso_visual_otro"],
        "prescripcionId": source["prescripcion_id"],
        "precioArmazon": source["precio_armazon_snapshot"],
        "precioDiseno": source["precio_diseno_snapshot"],
        "precioTratamiento": source["precio_tratamiento_snapshot"],
        "precioVariante": source["precio_variante_snapshot"],
        "subtotalBruto": source["subtotal_bruto_snapshot"],
    }


def _physical_costs(source: dict[str, Any]) -> tuple[Decimal | None, bool, str]:
    costs: list[Any] = []
    if source["diseno_producto_id"] is not None:
        costs.append(source["costo_diseno_snapshot"])
    if source["tratamiento_producto_id"] is not None:
        costs.append(
            source["costo_variante_snapshot"]
            if source["variante_id"] is not None
            else source["costo_tratamiento_snapshot"]
        )
    present = [Decimal(value) for value in costs if value is not None]
    estimate = sum(present, Decimal("0.00")) if present else None
    complete = bool(costs) and all(value is not None for value in costs)
    state = "estimado" if complete else "estimado_parcial" if present else "sin_estimar"
    return estimate, complete, state


def _physical_initial_state(source: dict[str, Any]) -> str:
    cancelled = (
        not source["venta_activa"]
        or source["estado_registro"] == "cancelado"
        or source["estado_venta"] in {"cancelada", "devuelta"}
    )
    if cancelled:
        return "cancelado"
    mapped = {
        "en_produccion": "en_fabricacion",
        "listo_para_entregar": "recibido",
        "entregado": "entregado",
        "cancelado": "cancelado",
    }.get(source["estado_produccion_fisica"])
    if mapped:
        return mapped
    ready = (
        source["monto_pagado"] > 0
        and source["estado_pago_calculado"] != "reembolsada"
        and source["estado_receta_calculado"] in {"proporcionada", "no_requerida"}
    )
    return "listo_para_produccion" if ready else "pendiente_requisitos"


def _replace_physical_components(
    cur, job_id: int, source: dict[str, Any], components: list[dict[str, Any]]
) -> None:
    cur.execute("DELETE FROM core.trabajo_optico_componentes WHERE trabajo_id=%s", (job_id,))
    for component in components:
        cost = component["costo_unitario_snapshot"]
        cur.execute(
            """INSERT INTO core.trabajo_optico_componentes
               (trabajo_id,tipo_componente,producto_id,variante_id,sku_snapshot,
                nombre_snapshot,variante_snapshot,comportamiento_abasto_snapshot,
                precio_ajuste_snapshot,costo_estimado_snapshot,
                estado_fuente_costo,incluye_costo_laboratorio)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (job_id, component["tipo_linea"], component["producto_id"],
             component["variante_id"], component["sku_snapshot"],
             component["nombre_snapshot"], component["variante_nombre_snapshot"],
             component["comportamiento_abasto_snapshot"],
             component["precio_unitario_snapshot"], cost,
             "catalogo_no_confirmado" if cost is not None else "ausente",
             component["tipo_linea"] in {"diseno", "tratamiento"}),
        )


def _find_physical_job(cur, source: dict[str, Any]) -> dict[str, Any] | None:
    cur.execute(
        """SELECT job.*
           FROM core.trabajos_opticos job
           JOIN core.venta_configuraciones_opticas old_config
             ON old_config.configuracion_id=job.venta_configuracion_id
           WHERE old_config.venta_id=%s
             AND old_config.configuracion_ref=%s
           ORDER BY job.trabajo_id
           FOR UPDATE OF job""",
        (source["venta_id"], source["configuracion_ref"]),
    )
    rows = _dict_rows(cur)
    if len(rows) > 1:
        raise RuntimeError(
            f"Multiple jobs exist for physical configuration {source['configuracion_ref']}"
        )
    return rows[0] if rows else None


def _sync_one_physical_job(
    cur, configuration_id: int, *, username: str | None, reason: str
) -> int:
    source = _physical_source(cur, configuration_id)
    components = _physical_components(cur, configuration_id)
    job = _find_physical_job(cur, source)
    estimate, complete, cost_state = _physical_costs(source)
    target_state = _physical_initial_state(source)
    snapshot = _physical_snapshot(source)
    if not job:
        cur.execute(
            """INSERT INTO core.trabajos_opticos
               (origen,venta_configuracion_id,sucursal_id,
                referencia_origen_snapshot,comportamiento_abasto,uso_visual,
                metodo_receta,requiere_receta,estado_receta,estado_pago,
                monto_pagado_confirmado,estado_costo_laboratorio,
                estado_produccion,moneda,precio_venta_snapshot,
                costo_armazon_snapshot,costo_laboratorio_estimado_snapshot,
                estimacion_costo_completa,configuracion_snapshot,cancelado_at)
               VALUES ('venta_fisica',%s,%s,%s,%s,%s,'prescripcion_optica',
                       %s,%s,%s,%s,%s,%s,'MXN',%s,%s,%s,%s,%s::jsonb,
                       CASE WHEN %s='cancelado' THEN NOW() ELSE NULL END)
               ON CONFLICT (venta_configuracion_id)
                 WHERE venta_configuracion_id IS NOT NULL DO NOTHING
               RETURNING trabajo_id""",
            (configuration_id, source["sucursal_id"],
             f"VENTA-{source['venta_id']}:{source['configuracion_ref']}",
             source["comportamiento_abasto_usado"], source["uso_visual"],
             source["requiere_receta"], source["estado_receta_calculado"],
             source["estado_pago_calculado"], source["monto_pagado"], cost_state,
             target_state, source["subtotal_bruto_snapshot"],
             source["costo_armazon_snapshot"], estimate, complete,
             _json(snapshot), target_state),
        )
        inserted = _dict_row(cur, cur.fetchone())
        if not inserted:
            cur.execute(
                "SELECT * FROM core.trabajos_opticos WHERE venta_configuracion_id=%s FOR UPDATE",
                (configuration_id,),
            )
            job = _dict_row(cur, cur.fetchone())
        else:
            job_id = int(inserted["trabajo_id"])
            _replace_physical_components(cur, job_id, source, components)
            _physical_event(
                cur, job_id, "trabajo_creado", username=username,
                new={"estadoProduccion": target_state,
                     "estadoReceta": source["estado_receta_calculado"],
                     "estadoPago": source["estado_pago_calculado"]},
                metadata={"origen": "venta_fisica", "ventaId": source["venta_id"],
                          "configuracionRef": source["configuracion_ref"], "reason": reason},
            )
            return job_id
    if not job:
        raise RuntimeError("Could not create or load physical optical job")
    previous = {
        "ventaConfiguracionId": job["venta_configuracion_id"],
        "estadoReceta": job["estado_receta"], "estadoPago": job["estado_pago"],
        "montoPagado": str(job["monto_pagado_confirmado"]),
        "estadoProduccion": job["estado_produccion"],
    }
    current_state = job["estado_produccion"]
    next_state = current_state
    if target_state == "cancelado":
        next_state = "cancelado"
    elif current_state in {"pendiente_requisitos", "listo_para_produccion"}:
        next_state = target_state
    refresh_snapshot = current_state in {"pendiente_requisitos", "listo_para_produccion"}
    cur.execute(
        """UPDATE core.trabajos_opticos
           SET venta_configuracion_id=%s, sucursal_id=%s,
               referencia_origen_snapshot=%s, comportamiento_abasto=%s,
               uso_visual=%s, metodo_receta='prescripcion_optica',
               requiere_receta=%s, estado_receta=%s, estado_pago=%s,
               monto_pagado_confirmado=%s, estado_produccion=%s,
               cancelado_at=CASE WHEN %s='cancelado' THEN COALESCE(cancelado_at,NOW()) ELSE NULL END,
               precio_venta_snapshot=CASE WHEN %s THEN %s ELSE precio_venta_snapshot END,
               costo_armazon_snapshot=CASE WHEN %s THEN %s ELSE costo_armazon_snapshot END,
               costo_laboratorio_estimado_snapshot=CASE WHEN %s THEN %s ELSE costo_laboratorio_estimado_snapshot END,
               estimacion_costo_completa=CASE WHEN %s THEN %s ELSE estimacion_costo_completa END,
               estado_costo_laboratorio=CASE WHEN %s THEN %s ELSE estado_costo_laboratorio END,
               configuracion_snapshot=CASE WHEN %s THEN %s::jsonb ELSE configuracion_snapshot END,
               version=version+1, updated_at=NOW()
           WHERE trabajo_id=%s""",
        (configuration_id, source["sucursal_id"],
         f"VENTA-{source['venta_id']}:{source['configuracion_ref']}",
         source["comportamiento_abasto_usado"], source["uso_visual"],
         source["requiere_receta"], source["estado_receta_calculado"],
         source["estado_pago_calculado"], source["monto_pagado"], next_state,
         next_state, refresh_snapshot, source["subtotal_bruto_snapshot"],
         refresh_snapshot, source["costo_armazon_snapshot"], refresh_snapshot,
         estimate, refresh_snapshot, complete, refresh_snapshot, cost_state,
         refresh_snapshot, _json(snapshot), job["trabajo_id"]),
    )
    if refresh_snapshot:
        _replace_physical_components(cur, int(job["trabajo_id"]), source, components)
    current = {
        "ventaConfiguracionId": configuration_id,
        "estadoReceta": source["estado_receta_calculado"],
        "estadoPago": source["estado_pago_calculado"],
        "montoPagado": str(source["monto_pagado"]),
        "estadoProduccion": next_state,
    }
    if previous != current or refresh_snapshot:
        event_type = "cancelado_por_venta" if next_state == "cancelado" and current_state != "cancelado" else "fuente_fisica_sincronizada"
        _physical_event(
            cur, int(job["trabajo_id"]), event_type, username=username,
            previous=previous, new=current,
            metadata={"ventaId": source["venta_id"],
                      "configuracionRef": source["configuracion_ref"], "reason": reason},
        )
    return int(job["trabajo_id"])


def sync_physical_sale_jobs(
    cur, venta_id: int, *, username: str | None = None, reason: str = "sale_sync"
) -> list[int]:
    """Create/rebind/synchronize all jobs for one physical sale transaction."""
    if not phase1gf_enabled():
        return []
    cur.execute(
        """SELECT configuracion_id FROM core.venta_configuraciones_opticas
           WHERE venta_id=%s AND estado_registro='activo'
           ORDER BY configuracion_id""",
        (venta_id,),
    )
    active_ids = [int(row["configuracion_id"]) for row in _dict_rows(cur)]
    job_ids = [
        _sync_one_physical_job(cur, config_id, username=username, reason=reason)
        for config_id in active_ids
    ]
    cur.execute(
        """SELECT job.trabajo_id, job.estado_produccion,
                  config.configuracion_ref, config.estado_registro
           FROM core.trabajos_opticos job
           JOIN core.venta_configuraciones_opticas config
             ON config.configuracion_id=job.venta_configuracion_id
           WHERE config.venta_id=%s AND job.origen='venta_fisica'
             AND config.estado_registro='cancelado'
           FOR UPDATE OF job""",
        (venta_id,),
    )
    for job in _dict_rows(cur):
        if job["estado_produccion"] == "cancelado":
            continue
        cur.execute(
            """UPDATE core.trabajos_opticos SET estado_produccion='cancelado',
                   cancelado_at=NOW(),version=version+1,updated_at=NOW()
               WHERE trabajo_id=%s""",
            (job["trabajo_id"],),
        )
        _physical_event(
            cur, int(job["trabajo_id"]), "cancelado_por_venta", username=username,
            previous={"estadoProduccion": job["estado_produccion"]},
            new={"estadoProduccion": "cancelado"},
            metadata={"ventaId": venta_id,
                      "configuracionRef": job["configuracion_ref"], "reason": reason},
        )
    return job_ids


def project_physical_job_status(cur, job_id: int, queue_state: str) -> None:
    projection = {
        "pendiente_requisitos": "pendiente_anticipo",
        "listo_para_produccion": "listo_para_produccion",
        "enviado_laboratorio": "en_produccion",
        "en_fabricacion": "en_produccion", "recibido": "listo_para_entregar",
        "entregado": "entregado", "cancelado": "cancelado",
    }[queue_state]
    cur.execute(
        """UPDATE core.venta_configuraciones_opticas config
           SET estado_produccion=%s
           FROM core.trabajos_opticos job
           WHERE job.trabajo_id=%s
             AND job.venta_configuracion_id=config.configuracion_id
             AND config.estado_registro='activo'
           RETURNING config.venta_id""",
        (projection, job_id),
    )
    row = _dict_row(cur, cur.fetchone())
    if not row:
        return
    venta_id = int(row["venta_id"])
    cur.execute(
        """SELECT estado_produccion FROM core.venta_configuraciones_opticas
           WHERE venta_id=%s AND estado_registro='activo'""",
        (venta_id,),
    )
    statuses = {item["estado_produccion"] for item in _dict_rows(cur)}
    if not statuses or statuses == {"entregado"}:
        order_state = "entregado"
    elif statuses.issubset({"listo_para_entregar", "entregado"}):
        order_state = "listo_entregar"
    elif statuses & {"en_produccion", "listo_para_produccion"}:
        order_state = "en_fabricacion"
    else:
        order_state = "pendiente_fabricacion"
    cur.execute(
        "UPDATE core.ventas SET estado_pedido=%s,updated_at=NOW() WHERE venta_id=%s",
        (order_state, venta_id),
    )


@dataclass(frozen=True)
class OpticalOperationsConfig:
    db_conninfo: str
    enabled: bool

    @classmethod
    def from_env(cls, db_conninfo: str) -> "OpticalOperationsConfig":
        return cls(db_conninfo=db_conninfo, enabled=phase1gd_enabled())


class StateUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    estado: Literal[
        "listo_para_produccion", "enviado_laboratorio",
        "en_fabricacion", "recibido", "entregado",
    ]
    version: int = Field(gt=0)
    notas: str | None = Field(default=None, max_length=2000)


class CostUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    costo: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    version: int = Field(gt=0)
    notas: str | None = Field(default=None, max_length=2000)


class NotesUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    notas: str | None = Field(default=None, max_length=5000)
    version: int = Field(gt=0)


class CancelRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    motivo: str = Field(min_length=3, max_length=2000)
    version: int = Field(gt=0)


def create_optical_operations_router(
    db_conninfo: str,
    get_current_user: Callable[..., dict[str, Any]],
    *,
    config: OpticalOperationsConfig | None = None,
    connect: Callable[..., Any] = psycopg.connect,
) -> APIRouter:
    cfg = config or OpticalOperationsConfig.from_env(db_conninfo)
    router = APIRouter(prefix="/operaciones/optica", tags=["Optical operations"])

    def admin(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        if not cfg.enabled:
            raise HTTPException(status_code=503, detail="La cola óptica está deshabilitada.")
        if user.get("rol") != "admin":
            raise HTTPException(status_code=403, detail="No tienes permisos para esta operación.")
        return user

    def connection():
        return connect(cfg.db_conninfo, row_factory=dict_row)

    def actor(cur, user: dict[str, Any]) -> dict[str, Any]:
        cur.execute("SELECT usuario_id, username, rol FROM core.usuarios WHERE username = %s AND activo = TRUE", (user["username"],))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Usuario interno no disponible.")
        return row

    def staff_event(cur, job_id: int, event_type: str, staff: dict[str, Any], **values: Any) -> None:
        cur.execute(
            """INSERT INTO core.trabajo_optico_eventos
               (trabajo_id, evento_tipo, actor_tipo, actor_usuario_id,
                actor_username_snapshot, actor_rol_snapshot, estado_anterior,
                estado_nuevo, notas, metadata)
               VALUES (%s, %s, 'staff', %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s::jsonb)""",
            (job_id, event_type, staff["usuario_id"], staff["username"], staff["rol"],
             _json(values.get("previous")) if values.get("previous") is not None else None,
             _json(values.get("new")) if values.get("new") is not None else None,
             values.get("notes"), _json(values.get("metadata") or {})),
        )

    def allowed_actions(row: dict[str, Any]) -> list[str]:
        state = row["estado_produccion"]
        if state in TERMINAL_PRODUCTION_STATES:
            return []
        if row["origen"] == "venta_fisica" and (
            not row.get("venta_activa", True)
            or row.get("estado_config_fisica") != "activo"
            or row.get("estado_venta_fisica") in {"cancelada", "devuelta"}
            or row["estado_pago"] == "reembolsada"
        ):
            return []
        if state == "pendiente_requisitos":
            prescription_ok = (not row["requiere_receta"] or row["estado_receta"] in {"proporcionada", "no_requerida"})
            payment_ok = Decimal(row["monto_pagado_confirmado"]) > 0 and row["estado_pago"] in {"anticipo", "pago_parcial", "pagada"}
            return ["listo_para_produccion"] if prescription_ok and payment_ok else []
        if state == "listo_para_produccion":
            if row["comportamiento_abasto"] == "laboratorio_bajo_pedido":
                return ["enviado_laboratorio"]
            if row["comportamiento_abasto"] == "fabricacion_interna":
                return ["en_fabricacion"]
            if row["comportamiento_abasto"] == "inventario":
                return ["recibido"]
            return []
        return {
            "enviado_laboratorio": ["en_fabricacion"],
            "en_fabricacion": ["recibido"],
            "recibido": ["entregado"],
        }.get(state, [])

    def blockers(row: dict[str, Any]) -> list[str]:
        result = []
        if row["origen"] == "venta_fisica":
            if not row.get("venta_activa", True) or row.get("estado_config_fisica") != "activo":
                result.append("Venta o configuracion inactiva")
            if row.get("estado_venta_fisica") in {"cancelada", "devuelta"}:
                result.append("Venta cancelada o devuelta")
            if row["estado_pago"] == "reembolsada":
                result.append("Pago reembolsado")
        if row["estado_produccion"] == "pendiente_requisitos":
            if row["requiere_receta"] and row["estado_receta"] == "pendiente":
                result.append("Falta receta")
            if Decimal(row["monto_pagado_confirmado"]) <= 0:
                result.append("Sin pago confirmado")
        return result

    def base_query() -> str:
        return """
            SELECT job.*, branch.nombre AS sucursal_nombre,
                   draft.estado AS estado_borrador,
                   physical_config.configuracion_ref AS configuracion_ref_fisica,
                   physical_config.venta_id AS venta_id_fisica,
                   physical_config.estado_registro AS estado_config_fisica,
                   physical_sale.estado_venta AS estado_venta_fisica,
                   physical_sale.activo AS venta_activa
            FROM core.trabajos_opticos job
            JOIN core.sucursales branch ON branch.sucursal_id = job.sucursal_id
            LEFT JOIN core.online_borradores_opticos draft
              ON draft.borrador_id = job.online_borrador_id
            LEFT JOIN core.venta_configuraciones_opticas physical_config
              ON physical_config.configuracion_id=job.venta_configuracion_id
            LEFT JOIN core.ventas physical_sale
              ON physical_sale.venta_id=physical_config.venta_id
        """

    def payload(cur, row: dict[str, Any], *, detail: bool) -> dict[str, Any]:
        data = {
            "trabajoPublicId": str(row["trabajo_public_id"]), "origen": row["origen"],
            "referencia": row["referencia_origen_snapshot"],
            "ventaId": row.get("venta_id_fisica"),
            "configuracionRef": row.get("configuracion_ref_fisica"),
            "sucursal": {"id": row["sucursal_id"], "nombre": row["sucursal_nombre"]},
            "usoVisual": row["uso_visual"], "comportamientoAbasto": row["comportamiento_abasto"],
            "estadoReceta": row["estado_receta"], "estadoPago": row["estado_pago"],
            "montoPagadoConfirmado": str(row["monto_pagado_confirmado"]),
            "estadoCosto": row["estado_costo_laboratorio"],
            "estadoProduccion": row["estado_produccion"],
            "precioVenta": str(row["precio_venta_snapshot"]),
            "costoArmazon": str(row["costo_armazon_snapshot"]) if row["costo_armazon_snapshot"] is not None else None,
            "costoLaboratorioEstimado": str(row["costo_laboratorio_estimado_snapshot"]) if row["costo_laboratorio_estimado_snapshot"] is not None else None,
            "estimacionCostoCompleta": row["estimacion_costo_completa"],
            "costoLaboratorioConfirmado": str(row["costo_laboratorio_confirmado"]) if row["costo_laboratorio_confirmado"] is not None else None,
            "moneda": row["moneda"], "notas": row["notas"], "version": row["version"],
            "bloqueos": blockers(row), "accionesPermitidas": allowed_actions(row),
            "createdAt": row["created_at"].isoformat(), "updatedAt": row["updated_at"].isoformat(),
        }
        if not detail:
            return data
        cur.execute("SELECT * FROM core.trabajo_optico_componentes WHERE trabajo_id = %s ORDER BY componente_id", (row["trabajo_id"],))
        data["componentes"] = [{
            "tipo": item["tipo_componente"], "productoId": item["producto_id"],
            "varianteId": item["variante_id"], "sku": item["sku_snapshot"],
            "nombre": item["nombre_snapshot"], "variante": item["variante_snapshot"],
            "precioAjuste": str(item["precio_ajuste_snapshot"]),
            "costoEstimado": str(item["costo_estimado_snapshot"]) if item["costo_estimado_snapshot"] is not None else None,
            "estadoFuenteCosto": item["estado_fuente_costo"],
        } for item in cur.fetchall()]
        cur.execute("SELECT * FROM core.trabajo_optico_eventos WHERE trabajo_id = %s ORDER BY created_at, evento_id", (row["trabajo_id"],))
        data["eventos"] = [{
            "tipo": event["evento_tipo"], "actor": event["actor_username_snapshot"] or "sistema",
            "rol": event["actor_rol_snapshot"], "notas": event["notas"],
            "metadata": event["metadata"], "createdAt": event["created_at"].isoformat(),
        } for event in cur.fetchall()]
        return data

    def fetch_job(cur, public_id: str, *, lock: bool = False) -> dict[str, Any]:
        query = base_query() + " WHERE job.trabajo_public_id = %s" + (" FOR UPDATE OF job" if lock else "")
        cur.execute(query, (public_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Trabajo óptico no encontrado.")
        return row

    @router.get("/trabajos")
    def list_jobs(
        estado_produccion: str | None = None, estado_receta: str | None = None,
        estado_pago: str | None = None, sucursal_id: int | None = None,
        origen: str | None = None, fecha_desde: date | None = None,
        fecha_hasta: date | None = None, buscar: str | None = None,
        incluir_cancelados: bool = False, limit: int = Query(100, ge=1, le=500),
        user: dict[str, Any] = Depends(admin),
    ):
        del user
        clauses, params = [], []
        if not incluir_cancelados:
            clauses.append("job.estado_produccion <> 'cancelado'")
        for column, value in (("estado_produccion", estado_produccion), ("estado_receta", estado_receta), ("estado_pago", estado_pago), ("origen", origen)):
            if value:
                clauses.append(f"job.{column} = %s"); params.append(value)
        if sucursal_id:
            clauses.append("job.sucursal_id = %s"); params.append(sucursal_id)
        if fecha_desde:
            clauses.append("job.created_at::date >= %s"); params.append(fecha_desde)
        if fecha_hasta:
            clauses.append("job.created_at::date <= %s"); params.append(fecha_hasta)
        if buscar:
            clauses.append("(job.referencia_origen_snapshot ILIKE %s OR EXISTS (SELECT 1 FROM core.trabajo_optico_componentes c WHERE c.trabajo_id = job.trabajo_id AND c.sku_snapshot ILIKE %s))")
            term = f"%{buscar.strip()}%"; params.extend([term, term])
        query = base_query() + (" WHERE " + " AND ".join(clauses) if clauses else "") + " ORDER BY job.created_at DESC LIMIT %s"
        params.append(limit)
        with connection() as conn, conn.cursor() as cur:
            cur.execute(query, params)
            return {"trabajos": [payload(cur, row, detail=False) for row in cur.fetchall()]}

    @router.get("/trabajos/{public_id}")
    def get_job(public_id: str, user: dict[str, Any] = Depends(admin)):
        del user
        with connection() as conn, conn.cursor() as cur:
            return payload(cur, fetch_job(cur, public_id), detail=True)

    @router.patch("/trabajos/{public_id}/estado")
    def update_state(public_id: str, data: StateUpdate, user: dict[str, Any] = Depends(admin)):
        with connection() as conn:
            with conn.cursor() as cur:
                row = fetch_job(cur, public_id, lock=True)
                if row["version"] != data.version:
                    raise HTTPException(status_code=409, detail="El trabajo cambió; actualiza antes de continuar.")
                if row["estado_borrador"] in {"cancelado", "expirado"}:
                    raise HTTPException(status_code=409, detail="El borrador de origen ya no está activo.")
                allowed = allowed_actions(row)
                if data.estado not in allowed:
                    raise HTTPException(status_code=409, detail={"message": "Transición de producción no permitida.", "bloqueos": blockers(row), "accionesPermitidas": allowed})
                staff = actor(cur, user)
                previous = row["estado_produccion"]
                cur.execute("UPDATE core.trabajos_opticos SET estado_produccion=%s, version=version+1, updated_at=NOW() WHERE trabajo_id=%s", (data.estado, row["trabajo_id"]))
                if row["origen"] == "venta_fisica":
                    project_physical_job_status(cur, int(row["trabajo_id"]), data.estado)
                staff_event(cur, row["trabajo_id"], "estado_produccion_cambiado", staff, previous={"estadoProduccion": previous}, new={"estadoProduccion": data.estado}, notes=data.notas)
                special = {"enviado_laboratorio": "enviado_laboratorio", "recibido": "recibido"}.get(data.estado)
                if special:
                    staff_event(cur, row["trabajo_id"], special, staff, notes=data.notas)
                result = payload(cur, fetch_job(cur, public_id), detail=True)
            conn.commit()
        return result

    @router.patch("/trabajos/{public_id}/costo-laboratorio")
    def update_cost(public_id: str, data: CostUpdate, user: dict[str, Any] = Depends(admin)):
        with connection() as conn:
            with conn.cursor() as cur:
                row = fetch_job(cur, public_id, lock=True)
                if row["version"] != data.version:
                    raise HTTPException(status_code=409, detail="El trabajo cambió; actualiza antes de continuar.")
                if row["estado_produccion"] in {"pendiente_requisitos", "listo_para_produccion", "cancelado"}:
                    raise HTTPException(status_code=409, detail="El costo real se confirma después de enviar el trabajo al laboratorio.")
                staff = actor(cur, user)
                cur.execute("""UPDATE core.trabajos_opticos SET estado_costo_laboratorio='confirmado', costo_laboratorio_confirmado=%s, costo_confirmado_by=%s, costo_confirmado_at=NOW(), version=version+1, updated_at=NOW() WHERE trabajo_id=%s""", (data.costo, staff["usuario_id"], row["trabajo_id"]))
                staff_event(cur, row["trabajo_id"], "costo_laboratorio_confirmado", staff, previous={"estadoCosto": row["estado_costo_laboratorio"], "costo": row["costo_laboratorio_confirmado"]}, new={"estadoCosto": "confirmado", "costo": str(data.costo)}, notes=data.notas)
                result = payload(cur, fetch_job(cur, public_id), detail=True)
            conn.commit()
        return result

    @router.patch("/trabajos/{public_id}/notas")
    def update_notes(public_id: str, data: NotesUpdate, user: dict[str, Any] = Depends(admin)):
        with connection() as conn:
            with conn.cursor() as cur:
                row = fetch_job(cur, public_id, lock=True)
                if row["version"] != data.version:
                    raise HTTPException(status_code=409, detail="El trabajo cambió; actualiza antes de continuar.")
                staff = actor(cur, user)
                cur.execute("UPDATE core.trabajos_opticos SET notas=%s, version=version+1, updated_at=NOW() WHERE trabajo_id=%s", (data.notas, row["trabajo_id"]))
                staff_event(cur, row["trabajo_id"], "notas_actualizadas", staff, notes=data.notas)
                result = payload(cur, fetch_job(cur, public_id), detail=True)
            conn.commit()
        return result

    @router.post("/trabajos/{public_id}/cancelar")
    def cancel(public_id: str, data: CancelRequest, user: dict[str, Any] = Depends(admin)):
        with connection() as conn:
            with conn.cursor() as cur:
                row = fetch_job(cur, public_id, lock=True)
                if row["version"] != data.version:
                    raise HTTPException(status_code=409, detail="El trabajo cambió; actualiza antes de continuar.")
                if row["estado_produccion"] == "cancelado":
                    return payload(cur, row, detail=True)
                if row["estado_produccion"] == "entregado":
                    raise HTTPException(status_code=409, detail="Un trabajo entregado no se puede cancelar.")
                if row["origen"] == "venta_fisica":
                    raise HTTPException(
                        status_code=409,
                        detail="Cancela la configuracion desde la venta para conservar inventario, pagos y auditoria sincronizados.",
                    )
                staff = actor(cur, user)
                if row["online_borrador_id"] is not None:
                    cur.execute("""SELECT r.reserva_id, r.estado, r.armazon_producto_id, r.sucursal_id, d.estado AS draft_state FROM core.online_reservas_opticas_borrador r JOIN core.online_borradores_opticos d USING (borrador_id) WHERE r.borrador_id=%s FOR UPDATE OF r, d""", (row["online_borrador_id"],))
                    reservation = cur.fetchone()
                    if reservation and reservation["estado"] == "activa":
                        cur.execute("SELECT stock_reservado FROM core.catalogo_inventario_sucursal WHERE producto_id=%s AND sucursal_id=%s FOR UPDATE", (reservation["armazon_producto_id"], reservation["sucursal_id"]))
                        inventory = cur.fetchone()
                        if not inventory or inventory["stock_reservado"] < 1:
                            raise HTTPException(status_code=409, detail="La reserva del armazón no coincide con inventario.")
                        cur.execute("UPDATE core.catalogo_inventario_sucursal SET stock_reservado=stock_reservado-1, version=version+1, updated_at=NOW() WHERE producto_id=%s AND sucursal_id=%s AND stock_reservado>=1", (reservation["armazon_producto_id"], reservation["sucursal_id"]))
                        cur.execute("UPDATE core.online_reservas_opticas_borrador SET estado='cancelada', released_at=NOW(), updated_at=NOW() WHERE reserva_id=%s", (reservation["reserva_id"],))
                    if reservation and reservation["draft_state"] not in {"cancelado", "expirado"}:
                        cur.execute("UPDATE core.online_borradores_opticos SET estado='cancelado', cancelado_at=NOW(), updated_at=NOW() WHERE borrador_id=%s", (row["online_borrador_id"],))
                        cur.execute("""INSERT INTO core.online_borrador_optico_eventos (borrador_id, reserva_id, evento_tipo, actor_tipo, metadata) VALUES (%s,%s,'draft_cancelled','staff',%s::jsonb) ON CONFLICT DO NOTHING""", (row["online_borrador_id"], reservation["reserva_id"] if reservation else None, _json({"reason": data.motivo})))
                cur.execute("UPDATE core.trabajos_opticos SET estado_produccion='cancelado', cancelado_at=NOW(), version=version+1, updated_at=NOW() WHERE trabajo_id=%s", (row["trabajo_id"],))
                staff_event(cur, row["trabajo_id"], "cancelado", staff, previous={"estadoProduccion": row["estado_produccion"]}, new={"estadoProduccion": "cancelado"}, notes=data.motivo)
                result = payload(cur, fetch_job(cur, public_id), detail=True)
            conn.commit()
        return result

    return router
