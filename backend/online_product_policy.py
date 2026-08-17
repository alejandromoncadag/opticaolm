"""Shared eligibility rules for direct online product purchases."""

from __future__ import annotations

from typing import Any, Mapping


PURCHASABLE_CATEGORIES = {
    "lentes_de_sol",
    "lentes_de_contacto",
    "accesorios_y_refacciones",
    "soluciones_y_cuidado",
}


def is_direct_purchase_product(product: Mapping[str, Any]) -> bool:
    """Return whether a product type is eligible for a simple online cart line."""
    category = str(product.get("categoria") or "")
    subcategory = str(product.get("subcategoria") or "")
    product_type = str(product.get("tipo_producto") or "")
    controls_stock = bool(product.get("controla_stock"))
    if product_type != "producto_fisico" or not controls_stock:
        return False
    if category in PURCHASABLE_CATEGORIES:
        return True
    return category == "lentes_opticos" and subcategory in {"armazon", "clip_on"}
