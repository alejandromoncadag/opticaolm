-- Phase 1A: additive global catalog and branch inventory foundation.
-- This file is executed by scripts/apply_phase1a_catalog.py inside one
-- PostgreSQL transaction. It intentionally contains no transaction control.

CREATE TABLE core.catalogo_productos (
    producto_id bigserial PRIMARY KEY,
    sku text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    nombre text NOT NULL,
    descripcion text NOT NULL,
    categoria text NOT NULL CHECK (
        categoria IN (
            'lentes_opticos',
            'micas',
            'lentes_de_sol',
            'examen_de_la_vista',
            'lentes_de_contacto',
            'accesorios_y_refacciones',
            'soluciones_y_cuidado'
        )
    ),
    subcategoria text NULL,
    tipo_producto text NOT NULL CHECK (
        tipo_producto IN ('producto_fisico', 'componente_mica', 'servicio')
    ),
    modalidad_precio text NOT NULL CHECK (
        modalidad_precio IN ('precio_base', 'ajuste_venta')
    ),
    precio numeric(12,2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
    moneda char(3) NOT NULL DEFAULT 'MXN',
    costo_unitario numeric(12,2) NULL CHECK (
        costo_unitario IS NULL OR costo_unitario >= 0
    ),
    costo_confirmado boolean NOT NULL DEFAULT false,
    controla_stock boolean NOT NULL DEFAULT false,
    comportamiento_abasto_default text NOT NULL CHECK (
        comportamiento_abasto_default IN (
            'inventario',
            'laboratorio_bajo_pedido',
            'fabricacion_interna',
            'servicio'
        )
    ),
    unidad_medida text NOT NULL CHECK (
        unidad_medida IN (
            'pieza',
            'caja',
            'par',
            'aplicacion_por_par',
            'servicio'
        )
    ),
    publicado_online boolean NOT NULL DEFAULT false,
    activo boolean NOT NULL DEFAULT true,
    orden_catalogo integer NOT NULL DEFAULT 100,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NULL,
    CONSTRAINT catalogo_productos_sku_formato_check
        CHECK (sku ~ '^[A-Z0-9-]+$'),
    CONSTRAINT catalogo_productos_slug_formato_check
        CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT catalogo_productos_costo_confirmado_check
        CHECK (costo_confirmado = false OR costo_unitario IS NOT NULL),
    CONSTRAINT catalogo_productos_stock_abasto_check
        CHECK (
            controla_stock = false
            OR comportamiento_abasto_default = 'inventario'
        )
);

CREATE INDEX idx_catalogo_productos_categoria
ON core.catalogo_productos (
    categoria,
    subcategoria,
    orden_catalogo,
    nombre
);

CREATE INDEX idx_catalogo_productos_publicacion
ON core.catalogo_productos (
    publicado_online,
    activo,
    updated_at
);

CREATE TABLE core.catalogo_inventario_sucursal (
    producto_id bigint NOT NULL,
    sucursal_id bigint NOT NULL,
    stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
    stock_reservado integer NOT NULL DEFAULT 0 CHECK (stock_reservado >= 0),
    stock_minimo integer NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    costo_promedio numeric(12,2) NULL CHECK (
        costo_promedio IS NULL OR costo_promedio >= 0
    ),
    disponible_venta boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NULL,
    PRIMARY KEY (producto_id, sucursal_id),
    CONSTRAINT catalogo_inventario_producto_fkey
        FOREIGN KEY (producto_id)
        REFERENCES core.catalogo_productos(producto_id),
    CONSTRAINT catalogo_inventario_sucursal_fkey
        FOREIGN KEY (sucursal_id)
        REFERENCES core.sucursales(sucursal_id),
    CONSTRAINT catalogo_inventario_disponible_check
        CHECK (stock_reservado <= stock)
);

CREATE INDEX idx_catalogo_inventario_sucursal
ON core.catalogo_inventario_sucursal (
    sucursal_id,
    disponible_venta,
    producto_id
);

CREATE TABLE core.catalogo_producto_imagenes (
    producto_imagen_id bigserial PRIMARY KEY,
    producto_id bigint NOT NULL,
    url text NOT NULL,
    alt_text text NULL,
    display_order integer NOT NULL DEFAULT 0,
    es_principal boolean NOT NULL DEFAULT false,
    mime_type text NOT NULL CHECK (
        mime_type IN ('image/jpeg', 'image/png', 'image/webp')
    ),
    ancho integer NULL CHECK (ancho IS NULL OR ancho > 0),
    alto integer NULL CHECK (alto IS NULL OR alto > 0),
    tamano_bytes bigint NULL CHECK (
        tamano_bytes IS NULL OR tamano_bytes > 0
    ),
    sha256 char(64) NULL,
    nombre_archivo_original text NULL,
    origen text NOT NULL DEFAULT 'opticaolm',
    activo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NULL,
    CONSTRAINT catalogo_imagenes_producto_fkey
        FOREIGN KEY (producto_id)
        REFERENCES core.catalogo_productos(producto_id),
    CONSTRAINT catalogo_imagenes_url_unique UNIQUE (producto_id, url),
    CONSTRAINT catalogo_imagenes_sha256_check CHECK (
        sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'
    )
);

CREATE UNIQUE INDEX uq_catalogo_imagen_principal
ON core.catalogo_producto_imagenes (producto_id)
WHERE es_principal = true AND activo = true;

CREATE TABLE core.catalogo_producto_variantes (
    variante_id bigserial PRIMARY KEY,
    producto_id bigint NOT NULL,
    codigo text NOT NULL,
    nombre text NOT NULL,
    precio_ajuste_override numeric(12,2) NULL CHECK (
        precio_ajuste_override IS NULL OR precio_ajuste_override >= 0
    ),
    costo_unitario numeric(12,2) NULL CHECK (
        costo_unitario IS NULL OR costo_unitario >= 0
    ),
    costo_confirmado boolean NOT NULL DEFAULT false,
    activo boolean NOT NULL DEFAULT true,
    orden integer NOT NULL DEFAULT 100,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NULL,
    CONSTRAINT catalogo_variantes_producto_fkey
        FOREIGN KEY (producto_id)
        REFERENCES core.catalogo_productos(producto_id),
    CONSTRAINT catalogo_variantes_codigo_unique
        UNIQUE (producto_id, codigo),
    CONSTRAINT catalogo_variantes_costo_confirmado_check
        CHECK (costo_confirmado = false OR costo_unitario IS NOT NULL)
);

INSERT INTO core.catalogo_productos (
    sku,
    slug,
    nombre,
    descripcion,
    categoria,
    subcategoria,
    tipo_producto,
    modalidad_precio,
    precio,
    moneda,
    costo_unitario,
    costo_confirmado,
    controla_stock,
    comportamiento_abasto_default,
    unidad_medida,
    publicado_online,
    activo,
    orden_catalogo
)
VALUES
    (
        'DEMO-RX-001', 'demo-armazon-modelo-clasico',
        'DEMO — Armazón Modelo Clásico',
        'Registro demostrativo temporal de armazón óptico.',
        'lentes_opticos', 'armazon', 'producto_fisico', 'precio_base',
        1499.00, 'MXN', NULL, false, true, 'inventario', 'pieza',
        false, true, 10
    ),
    (
        'DEMO-SUN-001', 'demo-lentes-sol-clasico',
        'DEMO — Lentes de sol Sol Clásico',
        'Registro demostrativo temporal de lentes de sol.',
        'lentes_de_sol', 'armazon', 'producto_fisico', 'precio_base',
        1599.00, 'MXN', NULL, false, true, 'inventario', 'pieza',
        false, true, 20
    ),
    (
        'DEMO-LC-001', 'demo-luma-daily-30',
        'DEMO — Luma Daily 30',
        'Registro demostrativo temporal de lentes de contacto.',
        'lentes_de_contacto', 'caja', 'producto_fisico', 'precio_base',
        899.00, 'MXN', NULL, false, true, 'inventario', 'caja',
        false, true, 30
    ),
    (
        'DEMO-ACC-001', 'demo-estuche-espresso',
        'DEMO — Estuche Espresso',
        'Registro demostrativo temporal de accesorio.',
        'accesorios_y_refacciones', 'estuche', 'producto_fisico',
        'precio_base', 349.00, 'MXN', NULL, false, true, 'inventario',
        'pieza', false, true, 40
    ),
    (
        'DEMO-CARE-001', 'demo-spray-pano-olm',
        'DEMO — Spray + Paño OLM',
        'Registro demostrativo temporal de limpieza y cuidado.',
        'soluciones_y_cuidado', 'limpieza', 'producto_fisico',
        'precio_base', 189.00, 'MXN', NULL, false, true, 'inventario',
        'pieza', false, true, 50
    ),
    (
        'DEMO-SVC-EYE-001', 'demo-examen-visual',
        'DEMO — Examen visual',
        'Registro demostrativo temporal de servicio de examen visual.',
        'examen_de_la_vista', 'servicio', 'servicio', 'precio_base',
        350.00, 'MXN', NULL, false, false, 'servicio', 'servicio',
        false, true, 60
    ),
    (
        'DEMO-LENS-MONO', 'demo-diseno-monofocal',
        'DEMO — Diseño monofocal',
        'Componente demostrativo de diseño monofocal por par.',
        'micas', 'diseno', 'componente_mica', 'ajuste_venta',
        0.00, 'MXN', NULL, false, false, 'laboratorio_bajo_pedido',
        'par', false, true, 100
    ),
    (
        'DEMO-LENS-BIFO', 'demo-diseno-bifocal',
        'DEMO — Diseño bifocal',
        'Componente demostrativo de diseño bifocal por par.',
        'micas', 'diseno', 'componente_mica', 'ajuste_venta',
        900.00, 'MXN', NULL, false, false, 'laboratorio_bajo_pedido',
        'par', false, true, 110
    ),
    (
        'DEMO-LENS-PROG', 'demo-diseno-progresivo',
        'DEMO — Diseño progresivo',
        'Componente demostrativo de diseño progresivo por par.',
        'micas', 'diseno', 'componente_mica', 'ajuste_venta',
        2200.00, 'MXN', NULL, false, false, 'laboratorio_bajo_pedido',
        'par', false, true, 120
    ),
    (
        'DEMO-LENS-NONRX', 'demo-diseno-sin-graduacion',
        'DEMO — Diseño sin graduación',
        'Componente demostrativo de diseño sin graduación por par.',
        'micas', 'diseno', 'componente_mica', 'ajuste_venta',
        0.00, 'MXN', NULL, false, false, 'laboratorio_bajo_pedido',
        'par', false, true, 130
    ),
    (
        'DEMO-TRT-AR', 'demo-tratamiento-antirreflejante',
        'DEMO — Tratamiento antirreflejante',
        'Aplicación demostrativa por par completado.',
        'micas', 'tratamiento', 'componente_mica', 'ajuste_venta',
        500.00, 'MXN', NULL, false, false, 'laboratorio_bajo_pedido',
        'aplicacion_por_par', false, true, 200
    ),
    (
        'DEMO-TRT-PHOTO', 'demo-tratamiento-fotocromatico',
        'DEMO — Tratamiento fotocromático',
        'Aplicación demostrativa por par completado.',
        'micas', 'tratamiento', 'componente_mica', 'ajuste_venta',
        1000.00, 'MXN', NULL, false, false, 'laboratorio_bajo_pedido',
        'aplicacion_por_par', false, true, 210
    ),
    (
        'DEMO-TRT-BLUE', 'demo-filtro-luz-azul',
        'DEMO — Filtro de luz azul',
        'Aplicación demostrativa por par con selección de reflejo.',
        'micas', 'tratamiento', 'componente_mica', 'ajuste_venta',
        1500.00, 'MXN', NULL, false, false, 'laboratorio_bajo_pedido',
        'aplicacion_por_par', false, true, 220
    ),
    (
        'DEMO-TRT-TINT', 'demo-tinte',
        'DEMO — Tinte',
        'Aplicación demostrativa de tinte por par completado.',
        'micas', 'tratamiento', 'componente_mica', 'ajuste_venta',
        1000.00, 'MXN', NULL, false, false, 'laboratorio_bajo_pedido',
        'aplicacion_por_par', false, true, 230
    );

INSERT INTO core.catalogo_producto_variantes (
    producto_id,
    codigo,
    nombre,
    precio_ajuste_override,
    costo_unitario,
    costo_confirmado,
    activo,
    orden
)
SELECT
    producto.producto_id,
    variante.codigo,
    variante.nombre,
    NULL,
    NULL,
    false,
    true,
    variante.orden
FROM core.catalogo_productos producto
JOIN (
    VALUES
        ('DEMO-TRT-BLUE', 'reflejo_verde', 'Reflejo verde', 10),
        ('DEMO-TRT-BLUE', 'reflejo_azul', 'Reflejo azul', 20),
        ('DEMO-TRT-TINT', 'gris', 'Gris', 10),
        ('DEMO-TRT-TINT', 'cafe', 'Café', 20),
        ('DEMO-TRT-TINT', 'verde', 'Verde', 30),
        ('DEMO-TRT-TINT', 'azul', 'Azul', 40),
        ('DEMO-TRT-TINT', 'rosa', 'Rosa', 50),
        ('DEMO-TRT-TINT', 'ambar', 'Ámbar', 60),
        ('DEMO-TRT-TINT', 'vino', 'Vino', 70),
        ('DEMO-TRT-TINT', 'morado', 'Morado', 80),
        ('DEMO-TRT-TINT', 'negro', 'Negro', 90),
        ('DEMO-TRT-TINT', 'naranja', 'Naranja', 100)
) AS variante (producto_sku, codigo, nombre, orden)
ON variante.producto_sku = producto.sku;

INSERT INTO core.catalogo_inventario_sucursal (
    producto_id,
    sucursal_id,
    stock,
    stock_reservado,
    stock_minimo,
    costo_promedio,
    disponible_venta,
    version
)
SELECT
    producto.producto_id,
    sucursal.sucursal_id,
    0,
    0,
    0,
    NULL,
    true,
    0
FROM core.catalogo_productos producto
CROSS JOIN core.sucursales sucursal
WHERE producto.controla_stock = true
  AND producto.sku IN (
      'DEMO-RX-001',
      'DEMO-SUN-001',
      'DEMO-LC-001',
      'DEMO-ACC-001',
      'DEMO-CARE-001'
  )
  AND sucursal.activa = true;

INSERT INTO core.catalogo_producto_imagenes (
    producto_id,
    url,
    alt_text,
    display_order,
    es_principal,
    mime_type,
    ancho,
    alto,
    tamano_bytes,
    sha256,
    nombre_archivo_original,
    origen,
    activo
)
SELECT
    producto.producto_id,
    imagen.url,
    imagen.alt_text,
    1,
    true,
    imagen.mime_type,
    imagen.ancho,
    imagen.alto,
    imagen.tamano_bytes,
    imagen.sha256,
    imagen.nombre_archivo,
    'olm_glasses',
    true
FROM core.catalogo_productos producto
JOIN (
    VALUES
        (
            'DEMO-RX-001',
            '/media/products/olm-glasses/olm/modelo-clasico.webp',
            'DEMO — Armazón Modelo Clásico',
            'image/webp', 1600, 1200, 36386::bigint,
            'f93d60d06ccd03eba621094df3dc4b66041b5b7f166e823c0a7be6d43ee7c03e',
            'modelo-clasico.webp'
        ),
        (
            'DEMO-SUN-001',
            '/media/products/olm-glasses/olm/sol-clasico.webp',
            'DEMO — Lentes de sol Sol Clásico',
            'image/webp', 1600, 1200, 36872::bigint,
            '975b4c6f5d4381e2163b94d27bba48a37a5ef9307f56d1aa4e4e5d232f8e4104',
            'sol-clasico.webp'
        ),
        (
            'DEMO-LC-001',
            '/media/products/olm-glasses/contacts/luma-daily.webp',
            'DEMO — Luma Daily 30',
            'image/webp', 1600, 854, 33580::bigint,
            'ebc81c599e3b0bd0c6138504492db7301121b3ada626d2b61429098b4a3f4b22',
            'luma-daily.webp'
        ),
        (
            'DEMO-ACC-001',
            '/media/products/olm-glasses/accessories/estuche-espresso.webp',
            'DEMO — Estuche Espresso',
            'image/webp', 1536, 1024, 55420::bigint,
            '2c161cb2ac081ac5a1212d492115435c34e0e83356806fbb874db77be30b2cd3',
            'estuche-espresso.webp'
        ),
        (
            'DEMO-CARE-001',
            '/media/products/olm-glasses/accessories/spray-limpiador.webp',
            'DEMO — Spray + Paño OLM',
            'image/webp', 1536, 1024, 28204::bigint,
            'cd6553e161df4ade985c2cc8aa46dbbf1df98b885d64734ebe46c277b93de1e6',
            'spray-limpiador.webp'
        ),
        (
            'DEMO-SVC-EYE-001',
            '/media/products/olm-glasses/eye-exam/adult-patient.png',
            'DEMO — Servicio de examen visual',
            'image/png', 1254, 1254, 2373672::bigint,
            '1c494a3d891d879289e63f0692be68f2dd167c562bee13a8b4074135d2ea5668',
            'adult-patient.png'
        )
) AS imagen (
    producto_sku,
    url,
    alt_text,
    mime_type,
    ancho,
    alto,
    tamano_bytes,
    sha256,
    nombre_archivo
)
ON imagen.producto_sku = producto.sku;
