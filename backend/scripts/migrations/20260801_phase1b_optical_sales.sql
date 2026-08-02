-- Phase 1B: global-catalog sales, optical configurations, ordered discounts,
-- prescription references, audited inventory movements and cancellations.
-- Executed by apply_phase1b_optical_sales.py inside one PostgreSQL transaction.

ALTER TABLE core.catalogo_productos
ADD COLUMN permite_graduacion boolean NOT NULL DEFAULT false;

UPDATE core.catalogo_productos
SET permite_graduacion = true,
    updated_at = NOW()
WHERE sku = 'DEMO-RX-001';

CREATE TABLE core.catalogo_inventario_movimientos (
    movimiento_id bigserial PRIMARY KEY,
    producto_id bigint NOT NULL REFERENCES core.catalogo_productos(producto_id),
    sucursal_id bigint NOT NULL REFERENCES core.sucursales(sucursal_id),
    tipo text NOT NULL CHECK (tipo IN (
        'entrada_compra', 'salida_venta', 'edicion_venta',
        'conteo_fisico', 'cancelacion_venta', 'ajuste_manual'
    )),
    cantidad integer NOT NULL,
    stock_anterior integer NOT NULL CHECK (stock_anterior >= 0),
    stock_nuevo integer NOT NULL CHECK (stock_nuevo >= 0),
    costo_unitario numeric(12,2) NULL CHECK (costo_unitario IS NULL OR costo_unitario >= 0),
    proveedor text NULL,
    folio text NULL,
    fuente_tipo text NULL,
    fuente_id bigint NULL,
    clave_idempotencia text NULL UNIQUE,
    notas text NULL,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_catalogo_movimientos_sucursal_fecha
ON core.catalogo_inventario_movimientos (sucursal_id, created_at DESC, movimiento_id DESC);

CREATE INDEX idx_catalogo_movimientos_producto
ON core.catalogo_inventario_movimientos (producto_id, sucursal_id, created_at DESC);

CREATE TABLE core.prescripciones_opticas (
    prescripcion_id bigserial PRIMARY KEY,
    paciente_id bigint NOT NULL REFERENCES core.pacientes(paciente_id),
    sucursal_captura_id bigint NOT NULL REFERENCES core.sucursales(sucursal_id),
    historia_id bigint NULL REFERENCES core.historias_clinicas(historia_id),
    origen text NOT NULL CHECK (origen IN ('interna', 'externa_cliente')),
    referencia_externa text NULL,
    fecha_prescripcion date NULL,
    od_esfera text NULL,
    od_cilindro text NULL,
    od_eje text NULL,
    od_adicion text NULL,
    oi_esfera text NULL,
    oi_cilindro text NULL,
    oi_eje text NULL,
    oi_adicion text NULL,
    distancia_pupilar text NULL,
    prisma text NULL,
    base_prisma text NULL,
    notas text NULL,
    activo boolean NOT NULL DEFAULT true,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prescripciones_opticas_paciente
ON core.prescripciones_opticas (paciente_id, fecha_prescripcion DESC, prescripcion_id DESC);

CREATE TABLE core.venta_catalogo_contextos (
    venta_id bigint PRIMARY KEY REFERENCES core.ventas(venta_id),
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    subtotal_bruto numeric(12,2) NOT NULL CHECK (subtotal_bruto >= 0),
    descuento_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (descuento_total >= 0),
    total_neto numeric(12,2) NOT NULL CHECK (total_neto >= 0),
    credito_cliente numeric(12,2) NOT NULL DEFAULT 0 CHECK (credito_cliente >= 0),
    estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'cancelado')),
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_by text NULL,
    updated_at timestamptz NULL
);

CREATE TABLE core.venta_configuraciones_opticas (
    configuracion_id bigserial PRIMARY KEY,
    venta_id bigint NOT NULL REFERENCES core.ventas(venta_id),
    configuracion_ref text NOT NULL,
    tipo_configuracion text NOT NULL CHECK (
        tipo_configuracion IN ('par_completo', 'solo_micas', 'solo_tratamiento')
    ),
    usa_armazon_cliente boolean NOT NULL DEFAULT false,
    armazon_producto_id bigint NULL REFERENCES core.catalogo_productos(producto_id),
    diseno_producto_id bigint NULL REFERENCES core.catalogo_productos(producto_id),
    tratamiento_producto_id bigint NULL REFERENCES core.catalogo_productos(producto_id),
    variante_id bigint NULL REFERENCES core.catalogo_producto_variantes(variante_id),
    uso_visual text NOT NULL CHECK (
        uso_visual IN ('lejos', 'cerca', 'intermedio', 'multifocal', 'sin_graduacion', 'otro')
    ),
    uso_visual_otro text NULL,
    prescripcion_id bigint NULL REFERENCES core.prescripciones_opticas(prescripcion_id),
    sucursal_prescripcion_snapshot bigint NULL REFERENCES core.sucursales(sucursal_id),
    comportamiento_abasto_usado text NOT NULL CHECK (
        comportamiento_abasto_usado IN (
            'inventario', 'laboratorio_bajo_pedido', 'fabricacion_interna', 'servicio'
        )
    ),
    estado_produccion text NOT NULL CHECK (
        estado_produccion IN (
            'pendiente_anticipo', 'listo_para_produccion', 'en_produccion',
            'listo_para_entregar', 'entregado', 'cancelado'
        )
    ),
    cantidad_pares integer NOT NULL DEFAULT 1 CHECK (cantidad_pares = 1),
    precio_armazon_snapshot numeric(12,2) NULL CHECK (precio_armazon_snapshot IS NULL OR precio_armazon_snapshot >= 0),
    precio_diseno_snapshot numeric(12,2) NULL CHECK (precio_diseno_snapshot IS NULL OR precio_diseno_snapshot >= 0),
    precio_tratamiento_snapshot numeric(12,2) NULL CHECK (precio_tratamiento_snapshot IS NULL OR precio_tratamiento_snapshot >= 0),
    precio_variante_snapshot numeric(12,2) NULL CHECK (precio_variante_snapshot IS NULL OR precio_variante_snapshot >= 0),
    costo_armazon_snapshot numeric(12,2) NULL CHECK (costo_armazon_snapshot IS NULL OR costo_armazon_snapshot >= 0),
    costo_diseno_snapshot numeric(12,2) NULL CHECK (costo_diseno_snapshot IS NULL OR costo_diseno_snapshot >= 0),
    costo_tratamiento_snapshot numeric(12,2) NULL CHECK (costo_tratamiento_snapshot IS NULL OR costo_tratamiento_snapshot >= 0),
    costo_variante_snapshot numeric(12,2) NULL CHECK (costo_variante_snapshot IS NULL OR costo_variante_snapshot >= 0),
    subtotal_bruto_snapshot numeric(12,2) NOT NULL CHECK (subtotal_bruto_snapshot >= 0),
    estado_registro text NOT NULL DEFAULT 'activo' CHECK (
        estado_registro IN ('activo', 'reemplazado', 'cancelado')
    ),
    motivo_cancelacion text NULL,
    cancelado_by text NULL,
    cancelado_at timestamptz NULL,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT venta_config_tipo_componentes_check CHECK (
        (tipo_configuracion = 'par_completo'
            AND usa_armazon_cliente = false
            AND armazon_producto_id IS NOT NULL
            AND diseno_producto_id IS NOT NULL)
        OR
        (tipo_configuracion = 'solo_micas'
            AND usa_armazon_cliente = true
            AND armazon_producto_id IS NULL
            AND diseno_producto_id IS NOT NULL)
        OR
        (tipo_configuracion = 'solo_tratamiento'
            AND usa_armazon_cliente = true
            AND armazon_producto_id IS NULL
            AND diseno_producto_id IS NULL
            AND tratamiento_producto_id IS NOT NULL)
    ),
    CONSTRAINT venta_config_otro_check CHECK (
        uso_visual <> 'otro' OR NULLIF(BTRIM(uso_visual_otro), '') IS NOT NULL
    )
);

CREATE UNIQUE INDEX uq_venta_config_ref_activa
ON core.venta_configuraciones_opticas (venta_id, configuracion_ref)
WHERE estado_registro = 'activo';

CREATE INDEX idx_venta_configuraciones_venta
ON core.venta_configuraciones_opticas (venta_id, estado_registro, configuracion_id);

CREATE TABLE core.venta_catalogo_detalles (
    venta_catalogo_detalle_id bigserial PRIMARY KEY,
    venta_id bigint NOT NULL REFERENCES core.ventas(venta_id),
    configuracion_id bigint NULL REFERENCES core.venta_configuraciones_opticas(configuracion_id),
    linea_ref text NOT NULL,
    tipo_linea text NOT NULL CHECK (
        tipo_linea IN ('producto', 'armazon', 'diseno', 'tratamiento')
    ),
    producto_id bigint NOT NULL REFERENCES core.catalogo_productos(producto_id),
    variante_id bigint NULL REFERENCES core.catalogo_producto_variantes(variante_id),
    sucursal_id bigint NOT NULL REFERENCES core.sucursales(sucursal_id),
    sku_snapshot text NOT NULL,
    nombre_snapshot text NOT NULL,
    descripcion_snapshot text NULL,
    categoria_snapshot text NOT NULL,
    subcategoria_snapshot text NULL,
    unidad_medida_snapshot text NOT NULL,
    comportamiento_abasto_snapshot text NOT NULL CHECK (
        comportamiento_abasto_snapshot IN (
            'inventario', 'laboratorio_bajo_pedido', 'fabricacion_interna', 'servicio'
        )
    ),
    controla_stock_snapshot boolean NOT NULL,
    cantidad integer NOT NULL CHECK (cantidad > 0),
    precio_unitario_snapshot numeric(12,2) NOT NULL CHECK (precio_unitario_snapshot >= 0),
    costo_unitario_snapshot numeric(12,2) NULL CHECK (costo_unitario_snapshot IS NULL OR costo_unitario_snapshot >= 0),
    subtotal_bruto_snapshot numeric(12,2) NOT NULL CHECK (subtotal_bruto_snapshot >= 0),
    estado_registro text NOT NULL DEFAULT 'activo' CHECK (
        estado_registro IN ('activo', 'reemplazado', 'cancelado')
    ),
    cantidad_cancelada integer NOT NULL DEFAULT 0 CHECK (
        cantidad_cancelada >= 0 AND cantidad_cancelada <= cantidad
    ),
    stock_restaurado integer NOT NULL DEFAULT 0 CHECK (
        stock_restaurado >= 0 AND stock_restaurado <= cantidad
    ),
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_venta_catalogo_linea_activa
ON core.venta_catalogo_detalles (venta_id, linea_ref)
WHERE estado_registro = 'activo';

CREATE INDEX idx_venta_catalogo_detalles_venta
ON core.venta_catalogo_detalles (venta_id, estado_registro, venta_catalogo_detalle_id);

CREATE TABLE core.venta_descuentos (
    descuento_id bigserial PRIMARY KEY,
    venta_id bigint NOT NULL REFERENCES core.ventas(venta_id),
    descuento_ref text NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('porcentaje', 'monto_fijo')),
    valor numeric(12,2) NOT NULL CHECK (valor > 0),
    motivo text NOT NULL CHECK (motivo IN (
        'familiar', 'cliente_referido', 'promocion_especial',
        'convenio_empresa_escuela_organizacion', 'cortesia',
        'cliente_frecuente', 'otro'
    )),
    motivo_otro text NULL,
    cupon_tipo text NOT NULL CHECK (cupon_tipo IN ('online', 'fisico', 'sin_cupon')),
    alcance text NOT NULL CHECK (alcance IN ('venta', 'configuracion', 'linea')),
    orden_aplicacion integer NOT NULL CHECK (orden_aplicacion > 0),
    base_elegible_snapshot numeric(12,2) NOT NULL CHECK (base_elegible_snapshot >= 0),
    monto_aplicado_snapshot numeric(12,2) NOT NULL CHECK (monto_aplicado_snapshot >= 0),
    estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'reemplazado', 'cancelado')),
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT venta_descuento_porcentaje_check CHECK (
        tipo <> 'porcentaje' OR valor <= 100
    ),
    CONSTRAINT venta_descuento_otro_check CHECK (
        motivo <> 'otro' OR NULLIF(BTRIM(motivo_otro), '') IS NOT NULL
    )
);

CREATE UNIQUE INDEX uq_venta_descuento_orden_activo
ON core.venta_descuentos (venta_id, orden_aplicacion)
WHERE estado = 'activo';

CREATE UNIQUE INDEX uq_venta_descuento_ref_activo
ON core.venta_descuentos (venta_id, descuento_ref)
WHERE estado = 'activo';

CREATE TABLE core.venta_descuento_objetivos (
    descuento_objetivo_id bigserial PRIMARY KEY,
    descuento_id bigint NOT NULL REFERENCES core.venta_descuentos(descuento_id),
    configuracion_id bigint NULL REFERENCES core.venta_configuraciones_opticas(configuracion_id),
    venta_catalogo_detalle_id bigint NULL REFERENCES core.venta_catalogo_detalles(venta_catalogo_detalle_id),
    CONSTRAINT venta_descuento_objetivo_unico_check CHECK (
        (configuracion_id IS NOT NULL AND venta_catalogo_detalle_id IS NULL)
        OR
        (configuracion_id IS NULL AND venta_catalogo_detalle_id IS NOT NULL)
    )
);

CREATE TABLE core.venta_calculo_revisiones (
    calculo_revision_id bigserial PRIMARY KEY,
    venta_id bigint NOT NULL REFERENCES core.ventas(venta_id),
    numero_revision integer NOT NULL CHECK (numero_revision > 0),
    motivo text NOT NULL CHECK (motivo IN ('creacion', 'edicion', 'cancelacion')),
    subtotal_bruto numeric(12,2) NOT NULL CHECK (subtotal_bruto >= 0),
    descuento_total numeric(12,2) NOT NULL CHECK (descuento_total >= 0),
    total_neto numeric(12,2) NOT NULL CHECK (total_neto >= 0),
    monto_pagado_snapshot numeric(12,2) NOT NULL CHECK (monto_pagado_snapshot >= 0),
    saldo_pendiente numeric(12,2) NOT NULL CHECK (saldo_pendiente >= 0),
    credito_cliente numeric(12,2) NOT NULL CHECK (credito_cliente >= 0),
    es_actual boolean NOT NULL DEFAULT true,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE (venta_id, numero_revision)
);

CREATE UNIQUE INDEX uq_venta_calculo_actual
ON core.venta_calculo_revisiones (venta_id)
WHERE es_actual = true;

CREATE TABLE core.venta_descuento_asignaciones (
    asignacion_id bigserial PRIMARY KEY,
    calculo_revision_id bigint NOT NULL REFERENCES core.venta_calculo_revisiones(calculo_revision_id),
    descuento_id bigint NOT NULL REFERENCES core.venta_descuentos(descuento_id),
    venta_catalogo_detalle_id bigint NOT NULL REFERENCES core.venta_catalogo_detalles(venta_catalogo_detalle_id),
    base_antes numeric(12,2) NOT NULL CHECK (base_antes >= 0),
    monto_asignado numeric(12,2) NOT NULL CHECK (monto_asignado >= 0),
    base_despues numeric(12,2) NOT NULL CHECK (base_despues >= 0),
    UNIQUE (calculo_revision_id, descuento_id, venta_catalogo_detalle_id)
);

CREATE TABLE core.venta_cancelaciones (
    cancelacion_id bigserial PRIMARY KEY,
    venta_id bigint NOT NULL REFERENCES core.ventas(venta_id),
    alcance text NOT NULL CHECK (alcance IN ('configuracion', 'linea', 'venta')),
    motivo text NOT NULL,
    subtotal_antes numeric(12,2) NOT NULL CHECK (subtotal_antes >= 0),
    descuento_antes numeric(12,2) NOT NULL CHECK (descuento_antes >= 0),
    total_antes numeric(12,2) NOT NULL CHECK (total_antes >= 0),
    subtotal_despues numeric(12,2) NOT NULL CHECK (subtotal_despues >= 0),
    descuento_despues numeric(12,2) NOT NULL CHECK (descuento_despues >= 0),
    total_despues numeric(12,2) NOT NULL CHECK (total_despues >= 0),
    monto_pagado_snapshot numeric(12,2) NOT NULL CHECK (monto_pagado_snapshot >= 0),
    credito_cliente numeric(12,2) NOT NULL CHECK (credito_cliente >= 0),
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE core.venta_cancelacion_objetivos (
    cancelacion_objetivo_id bigserial PRIMARY KEY,
    cancelacion_id bigint NOT NULL REFERENCES core.venta_cancelaciones(cancelacion_id),
    configuracion_id bigint NULL REFERENCES core.venta_configuraciones_opticas(configuracion_id),
    venta_catalogo_detalle_id bigint NULL REFERENCES core.venta_catalogo_detalles(venta_catalogo_detalle_id),
    cantidad_cancelada integer NOT NULL CHECK (cantidad_cancelada > 0),
    subtotal_bruto_cancelado numeric(12,2) NOT NULL CHECK (subtotal_bruto_cancelado >= 0),
    descuento_cancelado numeric(12,2) NOT NULL CHECK (descuento_cancelado >= 0),
    neto_cancelado numeric(12,2) NOT NULL CHECK (neto_cancelado >= 0),
    inventario_restaurado boolean NOT NULL DEFAULT false,
    clave_restauracion text NULL UNIQUE,
    CONSTRAINT venta_cancelacion_objetivo_unico_check CHECK (
        (configuracion_id IS NOT NULL AND venta_catalogo_detalle_id IS NULL)
        OR
        (configuracion_id IS NULL AND venta_catalogo_detalle_id IS NOT NULL)
    )
);

CREATE TABLE core.venta_ajustes_cliente (
    ajuste_id bigserial PRIMARY KEY,
    venta_id bigint NOT NULL REFERENCES core.ventas(venta_id),
    cancelacion_id bigint NULL REFERENCES core.venta_cancelaciones(cancelacion_id),
    tipo text NOT NULL CHECK (tipo IN ('credito', 'reembolso')),
    monto numeric(12,2) NOT NULL CHECK (monto > 0),
    estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aplicado', 'cancelado')),
    notas text NULL,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

