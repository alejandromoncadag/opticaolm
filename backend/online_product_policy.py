"""Shared eligibility rules for direct online product purchases."""

from __future__ import annotations

from typing import Any, Mapping


PURCHASABLE_CATEGORIES = {
    "lentes_de_sol",
    "lentes_de_contacto",
    "accesorios_y_refacciones",
    "soluciones_y_cuidado",
}


def is_configurable_optical_product(product: Mapping[str, Any]) -> bool:
    """Return whether a stocked eyewear product can use the optical configurator."""
    category = str(product.get("categoria") or "")
    subcategory = str(product.get("subcategoria") or "")
    return (
        str(product.get("tipo_producto") or "") == "producto_fisico"
        and bool(product.get("controla_stock"))
        and bool(product.get("activo", True))
        and bool(product.get("publicado_online", True))
        and (
            (category == "lentes_opticos" and subcategory in {"armazon", "clip_on"})
            or (category == "lentes_de_sol" and subcategory == "armazon")
        )
    )


def is_online_purchase_product(product: Mapping[str, Any]) -> bool:
    """Return whether a published product is eligible for an online purchase path."""
    return is_direct_purchase_product(product) or is_configurable_optical_product(product)


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
