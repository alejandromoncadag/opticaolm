from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import json
import os
import sys
import unittest

from fastapi import HTTPException
from fastapi.routing import APIRoute
from fastapi.security import HTTPAuthorizationCredentials
from dotenv import load_dotenv
import psycopg


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from public_catalog import (  # noqa: E402
    PublicBranch,
    PublicBranchAvailability,
    PublicCatalogConfig,
    PublicCatalogImage,
    PublicCatalogProduct,
    PublicCategory,
    PublicProductAvailability,
    SellingPrice,
    UnsafeImageUrl,
    catalog_credentials_valid,
    create_public_catalog_router,
    normalize_public_image_url,
)


NOW = datetime(2026, 8, 1, tzinfo=timezone.utc)


def sample_product(
    *,
    product_id: str = "1",
    slug: str = "catalogo-publicado",
    product_type: str = "producto_fisico",
    available: bool = True,
) -> PublicCatalogProduct:
    stock = 3 if available else 0
    return PublicCatalogProduct(
        productId=product_id,
        sku=f"PUBLIC-{product_id}",
        slug=slug,
        name="Producto publicado",
        description="Descripción pública",
        category="lentes_opticos",
        subcategory="armazon",
        productType=product_type,
        sellingPrice=SellingPrice(amount="1499.00", currency="MXN"),
        images=[
            PublicCatalogImage(
                imageId="9",
                url="http://127.0.0.1:8000/media/products/example.webp",
                altText="Producto publicado",
                displayOrder=0,
                isPrimary=True,
                mimeType="image/webp",
                width=1200,
                height=900,
            )
        ],
        availability=PublicProductAvailability(
            mode="branch_stock",
            controlsStock=True,
            availableOnline=available,
            totalOnlineAvailability=stock,
            branches=[
                PublicBranchAvailability(
                    branchId="1",
                    branchCode="EDOMEX",
                    branchName="EdoMex",
                    availableQuantity=stock,
                ),
                PublicBranchAvailability(
                    branchId="2",
                    branchCode="PLAYA",
                    branchName="Playa",
                    availableQuantity=0,
                ),
            ],
        ),
        publishedOnline=True,
        createdAt=NOW,
        updatedAt=NOW,
    )


class FakeRepository:
    def __init__(self) -> None:
        self.items = [sample_product(), sample_product(product_id="2", slug="agotado", available=False)]

    def health(self) -> None:
        return None

    def list_products(self, **_kwargs):
        return self.items, len(self.items)

    def get_product(self, slug: str, _branch_id=None):
        return next((item for item in self.items if item.slug == slug), None)

    def list_categories(self):
        return [PublicCategory(code="lentes_opticos", productCount=2)]

    def list_branches(self):
        return [PublicBranch(branchId="1", code="EDOMEX", name="EdoMex")]

    def get_availability(self, product_ids, _branch_id):
        return [
            {
                "productId": item.productId,
                "sku": item.sku,
                "availability": item.availability,
            }
            for item in self.items
            if int(item.productId) in product_ids
        ]


class PublicCatalogApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.config = PublicCatalogConfig(
            db_conninfo="unused",
            bearer_token="phase1e-test-token",
            media_base_url="http://127.0.0.1:8000",
            allowed_image_origins=("http://127.0.0.1:8000",),
        )
        cls.repository = FakeRepository()
        cls.router = create_public_catalog_router(
            "unused", config=cls.config, repository=cls.repository
        )
        cls.endpoints = {
            route.path: route.endpoint
            for route in cls.router.routes
            if isinstance(route, APIRoute)
        }

    def test_token_is_required_and_never_echoed(self) -> None:
        self.assertFalse(catalog_credentials_valid(None, "phase1e-test-token"))
        self.assertFalse(
            catalog_credentials_valid(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials="wrong"),
                "phase1e-test-token",
            )
        )
        self.assertTrue(
            catalog_credentials_valid(
                HTTPAuthorizationCredentials(
                    scheme="Bearer", credentials="phase1e-test-token"
                ),
                "phase1e-test-token",
            )
        )

    def test_published_products_and_branch_stock_are_returned(self) -> None:
        payload = self.endpoints["/public/catalog/v1/products"](
            category=None,
            search=None,
            branch_id=None,
            limit=50,
            offset=0,
        )
        self.assertEqual(2, payload.total)
        first = payload.products[0]
        self.assertTrue(first.publishedOnline)
        self.assertFalse(first.purchasableOnline)
        self.assertTrue(first.favoritable)
        self.assertIsNone(first.maximumQuantityPerLine)
        self.assertEqual("1499.00", first.sellingPrice.amount)
        self.assertEqual(3, first.availability.branches[0].availableQuantity)
        self.assertEqual(0, first.availability.branches[1].availableQuantity)

    def test_zero_stock_remains_visible_but_unavailable(self) -> None:
        payload = self.endpoints["/public/catalog/v1/products/{slug}"](
            "agotado", None
        )
        self.assertFalse(payload.product.availability.availableOnline)
        self.assertEqual(0, payload.product.availability.totalOnlineAvailability)

    def test_missing_or_unpublished_detail_is_404(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            self.endpoints["/public/catalog/v1/products/{slug}"](
                "no-publicado", None
            )
        self.assertEqual(404, caught.exception.status_code)

    def test_response_never_contains_internal_fields(self) -> None:
        payload = self.endpoints["/public/catalog/v1/products"](
            category=None,
            search=None,
            branch_id=None,
            limit=50,
            offset=0,
        )
        serialized = json.dumps(payload.model_dump(mode="json")).lower()
        for forbidden in (
            "costo_unitario",
            "costo_promedio",
            "profit",
            "margin",
            "paciente",
            "nomina",
            "usuario",
        ):
            self.assertNotIn(forbidden, serialized)

    def test_image_url_normalization_accepts_media_and_rejects_unsafe_paths(self) -> None:
        self.assertEqual(
            "http://127.0.0.1:8000/media/products/example.webp",
            normalize_public_image_url("/media/products/example.webp", self.config),
        )
        for unsafe in (
            "file:///media/products/example.webp",
            "data:image/png;base64,abc",
            "/media/../private/file.webp",
            "C:\\private\\file.webp",
            "https://unapproved.example/media/file.webp",
        ):
            with self.assertRaises(UnsafeImageUrl):
                normalize_public_image_url(unsafe, self.config)


class PublicCatalogLiveReadOnlySmokeTests(unittest.TestCase):
    def test_live_reads_do_not_mutate_operational_tables(self) -> None:
        load_dotenv(BACKEND_DIR / ".env")
        conninfo = os.getenv("DB_CONNINFO", "").strip()
        if not conninfo:
            self.skipTest("DB_CONNINFO is not configured")

        tracked_tables = (
            "core.ventas",
            "core.venta_pagos",
            "core.inventario_movimientos",
            "core.catalogo_inventario_movimientos",
        )
        try:
            with psycopg.connect(conninfo) as conn:
                with conn.cursor() as cur:
                    before = {}
                    for table in tracked_tables:
                        cur.execute(f"SELECT COUNT(*) FROM {table};")
                        before[table] = int(cur.fetchone()[0])

            config = PublicCatalogConfig(
                db_conninfo=conninfo,
                bearer_token="unused-live-test-token",
                media_base_url="http://127.0.0.1:8000",
                allowed_image_origins=("http://127.0.0.1:8000",),
            )
            from public_catalog import PublicCatalogRepository

            repository = PublicCatalogRepository(config)
            products, _total = repository.list_products(
                category=None,
                search=None,
                branch_id=None,
                limit=200,
                offset=0,
            )
            self.assertTrue(all(product.publishedOnline for product in products))

            with psycopg.connect(conninfo) as conn:
                with conn.cursor() as cur:
                    after = {}
                    for table in tracked_tables:
                        cur.execute(f"SELECT COUNT(*) FROM {table};")
                        after[table] = int(cur.fetchone()[0])
            self.assertEqual(before, after)
        except psycopg.OperationalError as exc:
            self.skipTest(f"Local PostgreSQL is not available: {exc}")


if __name__ == "__main__":
    unittest.main()
