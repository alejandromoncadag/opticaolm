BEGIN;

-- Phase 1G-D: internal operational queue for configured optical work.
-- Additive only. It creates no payment, sale, prescription, laboratory invoice,
-- payable, inventory movement, or permanent stock deduction.

CREATE TABLE core.trabajos_opticos (
    trabajo_id BIGSERIAL PRIMARY KEY,
    trabajo_public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    origen TEXT NOT NULL,
    online_borrador_id BIGINT NULL
        REFERENCES core.online_borradores_opticos(borrador_id),
    venta_configuracion_id BIGINT NULL
        REFERENCES core.venta_configuraciones_opticas(configuracion_id),
    sucursal_id BIGINT NOT NULL REFERENCES core.sucursales(sucursal_id),
    referencia_origen_snapshot TEXT NOT NULL,
    comportamiento_abasto TEXT NOT NULL,
    uso_visual TEXT NULL,
    metodo_receta TEXT NULL,
    requiere_receta BOOLEAN NOT NULL DEFAULT TRUE,
    estado_receta TEXT NOT NULL DEFAULT 'pendiente',
    estado_pago TEXT NOT NULL DEFAULT 'sin_pago',
    monto_pagado_confirmado NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado_costo_laboratorio TEXT NOT NULL DEFAULT 'sin_estimar',
    estado_produccion TEXT NOT NULL DEFAULT 'pendiente_requisitos',
    moneda CHAR(3) NOT NULL DEFAULT 'MXN',
    precio_venta_snapshot NUMERIC(12,2) NOT NULL,
    costo_armazon_snapshot NUMERIC(12,2) NULL,
    costo_laboratorio_estimado_snapshot NUMERIC(12,2) NULL,
    estimacion_costo_completa BOOLEAN NOT NULL DEFAULT FALSE,
    costo_laboratorio_confirmado NUMERIC(12,2) NULL,
    configuracion_snapshot JSONB NOT NULL,
    notas TEXT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    costo_confirmado_by BIGINT NULL REFERENCES core.usuarios(usuario_id),
    costo_confirmado_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelado_at TIMESTAMPTZ NULL,
    CONSTRAINT trabajos_opticos_origen_check CHECK (
        (origen = 'pedido_online' AND online_borrador_id IS NOT NULL
            AND venta_configuracion_id IS NULL)
        OR
        (origen = 'venta_fisica' AND venta_configuracion_id IS NOT NULL
            AND online_borrador_id IS NULL)
    ),
    CONSTRAINT trabajos_opticos_abasto_check CHECK (
        comportamiento_abasto IN (
            'inventario', 'laboratorio_bajo_pedido',
            'fabricacion_interna', 'servicio'
        )
    ),
    CONSTRAINT trabajos_opticos_uso_visual_check CHECK (
        uso_visual IS NULL OR uso_visual IN (
            'lejos', 'cerca', 'intermedio', 'multifocal',
            'sin_graduacion', 'otro'
        )
    ),
    CONSTRAINT trabajos_opticos_receta_check CHECK (
        estado_receta IN ('pendiente', 'proporcionada', 'no_requerida')
        AND (requiere_receta OR estado_receta = 'no_requerida')
    ),
    CONSTRAINT trabajos_opticos_pago_check CHECK (
        estado_pago IN (
            'sin_pago', 'anticipo', 'pago_parcial', 'pagada', 'reembolsada'
        )
        AND monto_pagado_confirmado >= 0
        AND (estado_pago <> 'sin_pago' OR monto_pagado_confirmado = 0)
    ),
    CONSTRAINT trabajos_opticos_costo_estado_check CHECK (
        estado_costo_laboratorio IN (
            'sin_estimar', 'estimado_parcial', 'estimado', 'confirmado'
        )
    ),
    CONSTRAINT trabajos_opticos_produccion_check CHECK (
        estado_produccion IN (
            'pendiente_requisitos', 'listo_para_produccion',
            'enviado_laboratorio', 'en_fabricacion', 'recibido',
            'entregado', 'cancelado'
        )
    ),
    CONSTRAINT trabajos_opticos_amounts_check CHECK (
        precio_venta_snapshot >= 0
        AND (costo_armazon_snapshot IS NULL OR costo_armazon_snapshot >= 0)
        AND (costo_laboratorio_estimado_snapshot IS NULL
             OR costo_laboratorio_estimado_snapshot >= 0)
        AND (costo_laboratorio_confirmado IS NULL
             OR costo_laboratorio_confirmado >= 0)
        AND moneda = 'MXN'
    ),
    CONSTRAINT trabajos_opticos_confirmacion_costo_check CHECK (
        (estado_costo_laboratorio = 'confirmado'
            AND costo_laboratorio_confirmado IS NOT NULL
            AND costo_confirmado_by IS NOT NULL
            AND costo_confirmado_at IS NOT NULL)
        OR
        (estado_costo_laboratorio <> 'confirmado'
            AND costo_laboratorio_confirmado IS NULL
            AND costo_confirmado_by IS NULL
            AND costo_confirmado_at IS NULL)
    ),
    CONSTRAINT trabajos_opticos_snapshot_check CHECK (
        jsonb_typeof(configuracion_snapshot) = 'object'
    ),
    CONSTRAINT trabajos_opticos_version_check CHECK (version > 0),
    CONSTRAINT trabajos_opticos_cancelacion_check CHECK (
        (estado_produccion = 'cancelado' AND cancelado_at IS NOT NULL)
        OR (estado_produccion <> 'cancelado' AND cancelado_at IS NULL)
    )
);

CREATE UNIQUE INDEX trabajos_opticos_online_borrador_uq
    ON core.trabajos_opticos (online_borrador_id)
    WHERE online_borrador_id IS NOT NULL;
CREATE UNIQUE INDEX trabajos_opticos_venta_configuracion_uq
    ON core.trabajos_opticos (venta_configuracion_id)
    WHERE venta_configuracion_id IS NOT NULL;
CREATE INDEX trabajos_opticos_queue_idx
    ON core.trabajos_opticos (estado_produccion, sucursal_id, created_at DESC);
CREATE INDEX trabajos_opticos_filters_idx
    ON core.trabajos_opticos (
        origen, estado_receta, estado_pago, updated_at DESC
    );

CREATE TABLE core.trabajo_optico_componentes (
    componente_id BIGSERIAL PRIMARY KEY,
    trabajo_id BIGINT NOT NULL REFERENCES core.trabajos_opticos(trabajo_id),
    tipo_componente TEXT NOT NULL,
    producto_id BIGINT NOT NULL REFERENCES core.catalogo_productos(producto_id),
    variante_id BIGINT NULL REFERENCES core.catalogo_producto_variantes(variante_id),
    sku_snapshot TEXT NOT NULL,
    nombre_snapshot TEXT NOT NULL,
    variante_snapshot TEXT NULL,
    comportamiento_abasto_snapshot TEXT NOT NULL,
    precio_ajuste_snapshot NUMERIC(12,2) NOT NULL,
    costo_estimado_snapshot NUMERIC(12,2) NULL,
    estado_fuente_costo TEXT NOT NULL,
    incluye_costo_laboratorio BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT trabajo_optico_componentes_tipo_check CHECK (
        tipo_componente IN ('armazon', 'diseno', 'tratamiento')
    ),
    CONSTRAINT trabajo_optico_componentes_abasto_check CHECK (
        comportamiento_abasto_snapshot IN (
            'inventario', 'laboratorio_bajo_pedido',
            'fabricacion_interna', 'servicio'
        )
    ),
    CONSTRAINT trabajo_optico_componentes_cost_source_check CHECK (
        estado_fuente_costo IN (
            'ausente', 'catalogo_no_confirmado',
            'catalogo_confirmado', 'no_aplica'
        )
    ),
    CONSTRAINT trabajo_optico_componentes_amounts_check CHECK (
        precio_ajuste_snapshot >= 0
        AND (costo_estimado_snapshot IS NULL OR costo_estimado_snapshot >= 0)
    ),
    CONSTRAINT trabajo_optico_componentes_cost_consistency_check CHECK (
        (estado_fuente_costo = 'ausente' AND costo_estimado_snapshot IS NULL)
        OR (estado_fuente_costo = 'no_aplica')
        OR (estado_fuente_costo IN ('catalogo_no_confirmado', 'catalogo_confirmado')
            AND costo_estimado_snapshot IS NOT NULL)
    ),
    CONSTRAINT trabajo_optico_componentes_tipo_uq
        UNIQUE (trabajo_id, tipo_componente)
);

CREATE INDEX trabajo_optico_componentes_catalogo_idx
    ON core.trabajo_optico_componentes (producto_id, variante_id);

CREATE TABLE core.trabajo_optico_eventos (
    evento_id BIGSERIAL PRIMARY KEY,
    trabajo_id BIGINT NOT NULL REFERENCES core.trabajos_opticos(trabajo_id),
    evento_tipo TEXT NOT NULL,
    actor_tipo TEXT NOT NULL,
    actor_usuario_id BIGINT NULL REFERENCES core.usuarios(usuario_id),
    actor_username_snapshot TEXT NULL,
    actor_rol_snapshot TEXT NULL,
    estado_anterior JSONB NULL,
    estado_nuevo JSONB NULL,
    notas TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT trabajo_optico_eventos_tipo_check CHECK (
        evento_tipo IN (
            'trabajo_creado', 'estado_produccion_cambiado',
            'costo_laboratorio_confirmado', 'enviado_laboratorio',
            'recibido', 'cancelado', 'cancelado_por_borrador',
            'cancelado_por_expiracion', 'notas_actualizadas'
        )
    ),
    CONSTRAINT trabajo_optico_eventos_actor_check CHECK (
        (actor_tipo = 'sistema' AND actor_usuario_id IS NULL)
        OR
        (actor_tipo = 'staff' AND actor_usuario_id IS NOT NULL
            AND NULLIF(BTRIM(actor_username_snapshot), '') IS NOT NULL
            AND NULLIF(BTRIM(actor_rol_snapshot), '') IS NOT NULL)
    ),
    CONSTRAINT trabajo_optico_eventos_json_check CHECK (
        (estado_anterior IS NULL OR jsonb_typeof(estado_anterior) = 'object')
        AND (estado_nuevo IS NULL OR jsonb_typeof(estado_nuevo) = 'object')
        AND jsonb_typeof(metadata) = 'object'
    )
);

CREATE UNIQUE INDEX trabajo_optico_eventos_creacion_uq
    ON core.trabajo_optico_eventos (trabajo_id, evento_tipo)
    WHERE evento_tipo = 'trabajo_creado';
CREATE INDEX trabajo_optico_eventos_history_idx
    ON core.trabajo_optico_eventos (trabajo_id, created_at, evento_id);

COMMIT;
