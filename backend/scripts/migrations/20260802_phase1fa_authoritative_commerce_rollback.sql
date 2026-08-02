BEGIN;

ALTER TABLE core.online_idempotencia
    RENAME TO online_idempotencia_phase1fa_isolated;
ALTER TABLE core.online_comercio_eventos
    RENAME TO online_comercio_eventos_phase1fa_isolated;
ALTER TABLE core.online_favoritos
    RENAME TO online_favoritos_phase1fa_isolated;
ALTER TABLE core.online_carrito_items
    RENAME TO online_carrito_items_phase1fa_isolated;
ALTER TABLE core.online_carritos
    RENAME TO online_carritos_phase1fa_isolated;
ALTER TABLE core.online_producto_configuracion_auditoria
    RENAME TO online_producto_configuracion_auditoria_phase1fa_isolated;
ALTER TABLE core.online_producto_configuracion
    RENAME TO online_producto_configuracion_phase1fa_isolated;

COMMIT;
