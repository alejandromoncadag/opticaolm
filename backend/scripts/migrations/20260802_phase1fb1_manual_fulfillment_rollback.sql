BEGIN;

CREATE SCHEMA IF NOT EXISTS phase1fb1_isolated;

ALTER TABLE core.online_cotizacion_envio_eventos SET SCHEMA phase1fb1_isolated;
ALTER TABLE core.online_checkout_previews SET SCHEMA phase1fb1_isolated;
ALTER TABLE core.online_cotizacion_selecciones SET SCHEMA phase1fb1_isolated;
ALTER TABLE core.online_opciones_cotizacion_envio SET SCHEMA phase1fb1_isolated;
ALTER TABLE core.online_solicitud_sucursales_elegibles SET SCHEMA phase1fb1_isolated;
ALTER TABLE core.online_solicitudes_cotizacion_envio SET SCHEMA phase1fb1_isolated;
ALTER TABLE core.envio_categoria_fallbacks SET SCHEMA phase1fb1_isolated;
ALTER TABLE core.catalogo_producto_envio SET SCHEMA phase1fb1_isolated;
ALTER TABLE core.envio_configuracion_empaque SET SCHEMA phase1fb1_isolated;
ALTER TABLE core.envio_transportistas SET SCHEMA phase1fb1_isolated;

ALTER SCHEMA phase1fb1_isolated RENAME TO phase1fb1_isolated_at_rollback;

COMMIT;
