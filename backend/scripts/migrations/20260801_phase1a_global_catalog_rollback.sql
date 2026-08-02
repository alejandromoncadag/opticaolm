-- Non-destructive Phase 1A isolation procedure.
-- Run only after stopping the application and confirming these backup names
-- are not already present. Data is retained under isolated table names.

BEGIN;

ALTER TABLE core.catalogo_producto_variantes
RENAME TO catalogo_producto_variantes_phase1a_backup;

ALTER TABLE core.catalogo_producto_imagenes
RENAME TO catalogo_producto_imagenes_phase1a_backup;

ALTER TABLE core.catalogo_inventario_sucursal
RENAME TO catalogo_inventario_sucursal_phase1a_backup;

ALTER TABLE core.catalogo_productos
RENAME TO catalogo_productos_phase1a_backup;

COMMIT;
