"""Shipping-rate provider abstractions for Phase 1F-B1."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any


@dataclass(frozen=True)
class ShippingRateQuote:
    branch_id: int
    carrier_code: str
    carrier_display_name: str
    service_level: str
    amount: Decimal
    currency: str
    minimum_delivery_days: int
    maximum_delivery_days: int
    quote_identifier: str
    calculated_at: datetime
    expires_at: datetime


class ShippingRateProvider:
    """Future carrier adapters and the manual provider share this contract."""

    provider_code = "abstract"

    def quote(self, request: dict[str, Any]) -> list[ShippingRateQuote]:
        raise NotImplementedError


class ManualShippingRateProvider(ShippingRateProvider):
    """Marker provider: staff enters approved quotes through the admin API."""

    provider_code = "manual"

    def quote(self, request: dict[str, Any]) -> list[ShippingRateQuote]:
        return []
