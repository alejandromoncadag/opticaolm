"""Package calculation contracts for Phase 1F-B1.

Only one combined package is supported. The list return type is intentional so
future phases can add multi-package calculation without changing snapshots.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


class PackageRuleError(RuntimeError):
    def __init__(self, code: str, message: str, *, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


@dataclass(frozen=True)
class ProductShippingMeasurement:
    product_id: int
    quantity: int
    weight_grams: int
    length_mm: int
    width_mm: int
    height_mm: int
    requires_individual_package: bool = False
    compatibility_group: str = "general"
    source: str = "product"


@dataclass(frozen=True)
class PackagingConfiguration:
    packaging_weight_grams: int
    padding_length_mm: int
    padding_width_mm: int
    padding_height_mm: int
    maximum_weight_grams: int
    maximum_length_mm: int
    maximum_width_mm: int
    maximum_height_mm: int


class PackageCalculator:
    """Contract for converting cart measurements into package snapshots."""

    def calculate(
        self,
        measurements: list[ProductShippingMeasurement],
        configuration: PackagingConfiguration,
    ) -> list[dict[str, Any]]:
        raise NotImplementedError


class SingleCombinedPackageCalculator(PackageCalculator):
    def calculate(
        self,
        measurements: list[ProductShippingMeasurement],
        configuration: PackagingConfiguration,
    ) -> list[dict[str, Any]]:
        if not measurements:
            raise PackageRuleError("EMPTY_CART", "The cart has no shippable products.")

        if any(item.requires_individual_package for item in measurements):
            raise PackageRuleError(
                "MULTI_PACKAGE_NOT_SUPPORTED",
                "At least one product requires an individual package.",
            )

        groups = {item.compatibility_group.strip().lower() for item in measurements}
        if len(groups) != 1:
            raise PackageRuleError(
                "MULTI_PACKAGE_NOT_SUPPORTED",
                "The cart contains products that cannot share one package.",
            )

        weight = configuration.packaging_weight_grams + sum(
            item.weight_grams * item.quantity for item in measurements
        )
        length = max(item.length_mm for item in measurements) + configuration.padding_length_mm
        width = max(item.width_mm for item in measurements) + configuration.padding_width_mm
        height = (
            sum(item.height_mm * item.quantity for item in measurements)
            + configuration.padding_height_mm
        )

        if (
            weight > configuration.maximum_weight_grams
            or length > configuration.maximum_length_mm
            or width > configuration.maximum_width_mm
            or height > configuration.maximum_height_mm
        ):
            raise PackageRuleError(
                "MULTI_PACKAGE_NOT_SUPPORTED",
                "The calculated package exceeds the approved one-package limits.",
                details={
                    "calculated": {
                        "weightGrams": weight,
                        "lengthMm": length,
                        "widthMm": width,
                        "heightMm": height,
                    }
                },
            )

        return [
            {
                "packageNumber": 1,
                "weightGrams": weight,
                "lengthMm": length,
                "widthMm": width,
                "heightMm": height,
                "compatibilityGroup": next(iter(groups)),
                "calculationMethod": "single_combined_v1",
                "measurementSources": [
                    {
                        "productId": str(item.product_id),
                        "quantity": item.quantity,
                        "source": item.source,
                    }
                    for item in measurements
                ],
            }
        ]
