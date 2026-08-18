"""Read-only public catalog contract for the OLM storefront.

This module intentionally selects only storefront-safe fields.  Every database
transaction is marked READ ONLY and every route requires a server-side bearer
token.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
import os
from pathlib import PurePosixPath
import secrets
from typing import Any, Callable
from urllib.parse import unquote, urljoin, urlsplit

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
import psycopg
from psycopg.rows import dict_row
from online_product_policy import is_online_purchase_product


CATALOG_SCHEMA_VERSION = "1.0"
PUBLIC_PRODUCT_TYPES = {"producto_fisico", "componente_mica", "servicio"}
class SellingPrice(BaseModel):
    amount: str
    currency: str


class PublicCatalogImage(BaseModel):
    imageId: str
    url: str
    altText: str
    displayOrder: int
    isPrimary: bool
    mimeType: str | None = None
    width: int | None = None
    height: int | None = None


class PublicBranchAvailability(BaseModel):
    branchId: str
    branchCode: str
    branchName: str
    availableQuantity: int


class PublicProductAvailability(BaseModel):
    mode: str
    controlsStock: bool
    availableOnline: bool
    totalOnlineAvailability: int | None
    branches: list[PublicBranchAvailability]


class PublicCatalogProduct(BaseModel):
    productId: str
    sku: str
    slug: str
    name: str
    description: str | None
    category: str
    subcategory: str | None
    productType: str
    sellingPrice: SellingPrice
    images: list[PublicCatalogImage]
    availability: PublicProductAvailability
    publishedOnline: bool
    purchasableOnline: bool = False
    favoritable: bool = True
    maximumQuantityPerLine: int | None = None
    createdAt: datetime
    updatedAt: datetime


class PublicProductListResponse(BaseModel):
    schemaVersion: str
    generatedAt: datetime
    products: list[PublicCatalogProduct]
    total: int
    limit: int
    offset: int


class PublicProductDetailResponse(BaseModel):
    schemaVersion: str
    generatedAt: datetime
    product: PublicCatalogProduct


class PublicCategory(BaseModel):
    code: str
    productCount: int


class PublicCategoryListResponse(BaseModel):
    schemaVersion: str
    categories: list[PublicCategory]


class PublicBranch(BaseModel):
    branchId: str
    code: str
    name: str


class PublicBranchListResponse(BaseModel):
    schemaVersion: str
    branches: list[PublicBranch]


class PublicAvailabilityItem(BaseModel):
    productId: str
    sku: str
    availability: PublicProductAvailability


class PublicAvailabilityResponse(BaseModel):
    schemaVersion: str
    generatedAt: datetime
    products: list[PublicAvailabilityItem]


@dataclass(frozen=True)
class PublicCatalogConfig:
    db_conninfo: str
    bearer_token: str
    media_base_url: str
    allowed_image_origins: tuple[str, ...]

    @classmethod
    def from_env(cls, db_conninfo: str) -> "PublicCatalogConfig":
        media_base_url = os.getenv(
            "PUBLIC_CATALOG_MEDIA_BASE_URL", "http://127.0.0.1:8000"
        ).strip().rstrip("/")
        configured_origins = [
            value.strip().rstrip("/").lower()
            for value in os.getenv("PUBLIC_CATALOG_IMAGE_ORIGINS", "").split(",")
            if value.strip()
        ]
        media_parts = urlsplit(media_base_url)
        if media_parts.scheme in {"http", "https"} and media_parts.netloc:
            media_origin = f"{media_parts.scheme}://{media_parts.netloc}".lower()
            if media_origin not in configured_origins:
                configured_origins.append(media_origin)
        return cls(
            db_conninfo=db_conninfo,
            bearer_token=os.getenv("PUBLIC_CATALOG_BEARER_TOKEN", "").strip(),
            media_base_url=media_base_url,
            allowed_image_origins=tuple(configured_origins),
        )


class UnsafeImageUrl(ValueError):
    pass


def catalog_credentials_valid(
    credentials: HTTPAuthorizationCredentials | None, expected_token: str
) -> bool:
    if not credentials or credentials.scheme.lower() != "bearer":
        return False
    return bool(expected_token) and secrets.compare_digest(
        credentials.credentials, expected_token
    )


def normalize_public_image_url(raw_url: str, config: PublicCatalogConfig) -> str:
    """Return a safe public media URL without touching or transforming the file."""

    value = str(raw_url or "").strip()
    if not value or "\\" in value:
        raise UnsafeImageUrl("Unsafe image URL")

    parsed = urlsplit(value)
    decoded_path = unquote(parsed.path)
    path_parts = PurePosixPath(decoded_path).parts
    if ".." in path_parts or not decoded_path.startswith("/media/"):
        raise UnsafeImageUrl("Unsafe image URL")

    if parsed.scheme:
        if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc:
            raise UnsafeImageUrl("Unsafe image URL")
        origin = f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"
        if origin not in config.allowed_image_origins:
            raise UnsafeImageUrl("Unsafe image URL")
        return value

    if parsed.netloc or parsed.query or parsed.fragment:
        raise UnsafeImageUrl("Unsafe image URL")
    base = f"{config.media_base_url.rstrip('/')}/"
    return urljoin(base, decoded_path.lstrip("/"))


def _money(value: Decimal | int | float | str) -> str:
    return f"{Decimal(value):.2f}"


class PublicCatalogRepository:
    def __init__(
        self,
        config: PublicCatalogConfig,
        connect: Callable[..., Any] = psycopg.connect,
    ) -> None:
        self.config = config
        self._connect = connect

    def _connection(self):
        return self._connect(self.config.db_conninfo, row_factory=dict_row)

    @staticmethod
    def _active_branches(cur, branch_id: int | None = None) -> list[dict[str, Any]]:
        sql = """
            SELECT sucursal_id, codigo, nombre
            FROM core.sucursales
            WHERE activa = true
        """
        params: tuple[Any, ...] = ()
        if branch_id is not None:
            sql += " AND sucursal_id = %s"
            params = (branch_id,)
        sql += " ORDER BY sucursal_id"
        cur.execute(sql, params)
        return list(cur.fetchall())

    def _images(self, cur, product_ids: list[int]) -> dict[int, list[PublicCatalogImage]]:
        images: dict[int, list[PublicCatalogImage]] = {pid: [] for pid in product_ids}
        if not product_ids:
            return images
        cur.execute(
            """
            SELECT producto_imagen_id, producto_id, url, alt_text,
                   display_order, es_principal, mime_type, ancho, alto
            FROM core.catalogo_producto_imagenes
            WHERE activo = true
              AND producto_id = ANY(%s)
            ORDER BY producto_id, es_principal DESC, display_order, producto_imagen_id;
            """,
            (product_ids,),
        )
        for row in cur.fetchall():
            try:
                safe_url = normalize_public_image_url(row["url"], self.config)
            except UnsafeImageUrl:
                continue
            images[int(row["producto_id"])].append(
                PublicCatalogImage(
                    imageId=str(row["producto_imagen_id"]),
                    url=safe_url,
                    altText=str(row["alt_text"] or "Imagen de producto"),
                    displayOrder=int(row["display_order"]),
                    isPrimary=bool(row["es_principal"]),
                    mimeType=row["mime_type"],
                    width=row["ancho"],
                    height=row["alto"],
                )
            )
        return images

    @staticmethod
    def _commerce_settings(cur, product_ids: list[int]) -> dict[int, dict[str, Any]]:
        if not product_ids:
            return {}
        cur.execute(
            """
            SELECT producto_id, comprable_online, permite_favorito,
                   cantidad_maxima_por_linea
            FROM core.online_producto_configuracion
            WHERE producto_id = ANY(%s)
            """,
            (product_ids,),
        )
        return {
            int(row["producto_id"]): {
                "purchasable": bool(row["comprable_online"]),
                "favoritable": bool(row["permite_favorito"]),
                "maximum": (
                    int(row["cantidad_maxima_por_linea"])
                    if row["cantidad_maxima_por_linea"] is not None
                    else None
                ),
            }
            for row in cur.fetchall()
        }

    @staticmethod
    def _availability(
        cur,
        product_rows: list[dict[str, Any]],
        branches: list[dict[str, Any]],
    ) -> dict[int, PublicProductAvailability]:
        physical_ids = [
            int(row["producto_id"])
            for row in product_rows
            if bool(row["controla_stock"])
        ]
        quantities: dict[tuple[int, int], int] = {}
        if physical_ids and branches:
            branch_ids = [int(branch["sucursal_id"]) for branch in branches]
            cur.execute(
                """
                SELECT producto_id, sucursal_id,
                       CASE
                         WHEN disponible_venta = true
                         THEN GREATEST(stock - stock_reservado, 0)
                         ELSE 0
                       END AS disponible
                FROM core.catalogo_inventario_sucursal
                WHERE producto_id = ANY(%s)
                  AND sucursal_id = ANY(%s);
                """,
                (physical_ids, branch_ids),
            )
            quantities = {
                (int(row["producto_id"]), int(row["sucursal_id"])): int(
                    row["disponible"]
                )
                for row in cur.fetchall()
            }

        result: dict[int, PublicProductAvailability] = {}
        for product in product_rows:
            product_id = int(product["producto_id"])
            controls_stock = bool(product["controla_stock"])
            if not controls_stock:
                result[product_id] = PublicProductAvailability(
                    mode="not_stock_controlled",
                    controlsStock=False,
                    availableOnline=True,
                    totalOnlineAvailability=None,
                    branches=[],
                )
                continue

            branch_rows = [
                PublicBranchAvailability(
                    branchId=str(branch["sucursal_id"]),
                    branchCode=str(branch["codigo"]),
                    branchName=str(branch["nombre"]),
                    availableQuantity=quantities.get(
                        (product_id, int(branch["sucursal_id"])), 0
                    ),
                )
                for branch in branches
            ]
            total = sum(branch.availableQuantity for branch in branch_rows)
            result[product_id] = PublicProductAvailability(
                mode="branch_stock",
                controlsStock=True,
                availableOnline=total > 0,
                totalOnlineAvailability=total,
                branches=branch_rows,
            )
        return result

    def _hydrate(
        self,
        cur,
        rows: list[dict[str, Any]],
        branch_id: int | None,
    ) -> list[PublicCatalogProduct]:
        product_ids = [int(row["producto_id"]) for row in rows]
        images = self._images(cur, product_ids)
        commerce = self._commerce_settings(cur, product_ids)
        branches = self._active_branches(cur, branch_id)
        availability = self._availability(cur, rows, branches)
        products: list[PublicCatalogProduct] = []
        for row in rows:
            product_id = int(row["producto_id"])
            product_type = str(row["tipo_producto"])
            if product_type not in PUBLIC_PRODUCT_TYPES:
                continue
            settings = commerce.get(
                product_id,
                {"purchasable": False, "favoritable": True, "maximum": None},
            )
            can_purchase = bool(
                settings["purchasable"]
                and is_online_purchase_product(row)
            )
            products.append(
                PublicCatalogProduct(
                    productId=str(product_id),
                    sku=str(row["sku"]),
                    slug=str(row["slug"]),
                    name=str(row["nombre"]),
                    description=row["descripcion"],
                    category=str(row["categoria"]),
                    subcategory=row["subcategoria"],
                    productType=product_type,
                    sellingPrice=SellingPrice(
                        amount=_money(row["precio"]),
                        currency=str(row["moneda"]).strip(),
                    ),
                    images=images.get(product_id, []),
                    availability=availability[product_id],
                    publishedOnline=True,
                    purchasableOnline=can_purchase,
                    favoritable=bool(settings["favoritable"]),
                    maximumQuantityPerLine=settings["maximum"],
                    createdAt=row["created_at"],
                    updatedAt=row["updated_at"] or row["created_at"],
                )
            )
        return products

    def list_products(
        self,
        *,
        category: str | None,
        search: str | None,
        branch_id: int | None,
        limit: int,
        offset: int,
    ) -> tuple[list[PublicCatalogProduct], int]:
        where = ["activo = true", "publicado_online = true"]
        params: list[Any] = []
        if category:
            where.append("categoria = %s")
            params.append(category.strip())
        if search:
            where.append("(nombre ILIKE %s OR sku ILIKE %s OR descripcion ILIKE %s)")
            pattern = f"%{search.strip()}%"
            params.extend([pattern, pattern, pattern])
        where_sql = " AND ".join(where)
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION READ ONLY;")
                cur.execute(
                    f"SELECT COUNT(*) AS total FROM core.catalogo_productos WHERE {where_sql};",
                    tuple(params),
                )
                total = int(cur.fetchone()["total"])
                cur.execute(
                    f"""
                    SELECT producto_id, sku, slug, nombre, descripcion, categoria,
                           subcategoria, tipo_producto, precio, moneda, controla_stock,
                           created_at, updated_at
                    FROM core.catalogo_productos
                    WHERE {where_sql}
                    ORDER BY orden_catalogo, nombre, producto_id
                    LIMIT %s OFFSET %s;
                    """,
                    (*params, limit, offset),
                )
                rows = list(cur.fetchall())
                return self._hydrate(cur, rows, branch_id), total

    def get_product(
        self, slug: str, branch_id: int | None = None
    ) -> PublicCatalogProduct | None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION READ ONLY;")
                cur.execute(
                    """
                    SELECT producto_id, sku, slug, nombre, descripcion, categoria,
                           subcategoria, tipo_producto, precio, moneda, controla_stock,
                           created_at, updated_at
                    FROM core.catalogo_productos
                    WHERE slug = %s AND activo = true AND publicado_online = true
                    LIMIT 1;
                    """,
                    (slug,),
                )
                row = cur.fetchone()
                if row is None:
                    return None
                return self._hydrate(cur, [row], branch_id)[0]

    def list_categories(self) -> list[PublicCategory]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION READ ONLY;")
                cur.execute(
                    """
                    SELECT categoria, COUNT(*) AS total
                    FROM core.catalogo_productos
                    WHERE activo = true AND publicado_online = true
                    GROUP BY categoria
                    ORDER BY categoria;
                    """
                )
                return [
                    PublicCategory(code=row["categoria"], productCount=int(row["total"]))
                    for row in cur.fetchall()
                ]

    def list_branches(self) -> list[PublicBranch]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION READ ONLY;")
                return [
                    PublicBranch(
                        branchId=str(row["sucursal_id"]),
                        code=str(row["codigo"]),
                        name=str(row["nombre"]),
                    )
                    for row in self._active_branches(cur)
                ]

    def get_availability(
        self,
        product_ids: list[int],
        branch_id: int | None,
    ) -> list[PublicAvailabilityItem]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION READ ONLY;")
                cur.execute(
                    """
                    SELECT producto_id, sku, slug, nombre, descripcion, categoria,
                           subcategoria, tipo_producto, precio, moneda, controla_stock,
                           created_at, updated_at
                    FROM core.catalogo_productos
                    WHERE producto_id = ANY(%s)
                      AND activo = true
                      AND publicado_online = true
                    ORDER BY producto_id;
                    """,
                    (product_ids,),
                )
                rows = list(cur.fetchall())
                products = self._hydrate(cur, rows, branch_id)
                return [
                    PublicAvailabilityItem(
                        productId=product.productId,
                        sku=product.sku,
                        availability=product.availability,
                    )
                    for product in products
                ]

    def health(self) -> None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION READ ONLY;")
                cur.execute("SELECT 1;")
                cur.fetchone()


def create_public_catalog_router(
    db_conninfo: str,
    *,
    config: PublicCatalogConfig | None = None,
    repository: PublicCatalogRepository | None = None,
) -> APIRouter:
    config = config or PublicCatalogConfig.from_env(db_conninfo)
    repository = repository or PublicCatalogRepository(config)
    router = APIRouter(prefix="/public/catalog/v1", tags=["Public catalog"])
    bearer = HTTPBearer(auto_error=False)

    def require_catalog_token(
        credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    ) -> None:
        if not config.bearer_token:
            raise HTTPException(status_code=503, detail="Public catalog is not configured.")
        if not catalog_credentials_valid(credentials, config.bearer_token):
            raise HTTPException(
                status_code=401,
                detail="Invalid catalog credentials.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    def unavailable() -> HTTPException:
        return HTTPException(status_code=503, detail="Catalog temporarily unavailable.")

    @router.get("/health", dependencies=[Depends(require_catalog_token)])
    def health():
        try:
            repository.health()
        except psycopg.Error:
            raise unavailable()
        return {"status": "ok", "schemaVersion": CATALOG_SCHEMA_VERSION}

    @router.get(
        "/products",
        response_model=PublicProductListResponse,
        dependencies=[Depends(require_catalog_token)],
    )
    def products(
        category: str | None = None,
        search: str | None = None,
        branch_id: int | None = Query(default=None, ge=1),
        limit: int = Query(default=50, ge=1, le=200),
        offset: int = Query(default=0, ge=0),
    ):
        try:
            items, total = repository.list_products(
                category=category,
                search=search,
                branch_id=branch_id,
                limit=limit,
                offset=offset,
            )
        except psycopg.Error:
            raise unavailable()
        return PublicProductListResponse(
            schemaVersion=CATALOG_SCHEMA_VERSION,
            generatedAt=datetime.now(timezone.utc),
            products=items,
            total=total,
            limit=limit,
            offset=offset,
        )

    @router.get(
        "/products/{slug}",
        response_model=PublicProductDetailResponse,
        dependencies=[Depends(require_catalog_token)],
    )
    def product(slug: str, branch_id: int | None = Query(default=None, ge=1)):
        try:
            item = repository.get_product(slug, branch_id)
        except psycopg.Error:
            raise unavailable()
        if item is None:
            raise HTTPException(status_code=404, detail="Product not found.")
        return PublicProductDetailResponse(
            schemaVersion=CATALOG_SCHEMA_VERSION,
            generatedAt=datetime.now(timezone.utc),
            product=item,
        )

    @router.get(
        "/categories",
        response_model=PublicCategoryListResponse,
        dependencies=[Depends(require_catalog_token)],
    )
    def categories():
        try:
            items = repository.list_categories()
        except psycopg.Error:
            raise unavailable()
        return PublicCategoryListResponse(
            schemaVersion=CATALOG_SCHEMA_VERSION, categories=items
        )

    @router.get(
        "/branches",
        response_model=PublicBranchListResponse,
        dependencies=[Depends(require_catalog_token)],
    )
    def branches():
        try:
            items = repository.list_branches()
        except psycopg.Error:
            raise unavailable()
        return PublicBranchListResponse(
            schemaVersion=CATALOG_SCHEMA_VERSION, branches=items
        )

    @router.get(
        "/availability",
        response_model=PublicAvailabilityResponse,
        dependencies=[Depends(require_catalog_token)],
    )
    def availability(
        product_id: list[int] = Query(default=[]),
        branch_id: int | None = Query(default=None, ge=1),
    ):
        unique_ids = sorted({value for value in product_id if value > 0})
        if not unique_ids or len(unique_ids) > 100:
            raise HTTPException(
                status_code=400,
                detail="Provide between 1 and 100 valid product_id values.",
            )
        try:
            items = repository.get_availability(unique_ids, branch_id)
        except psycopg.Error:
            raise unavailable()
        return PublicAvailabilityResponse(
            schemaVersion=CATALOG_SCHEMA_VERSION,
            generatedAt=datetime.now(timezone.utc),
            products=items,
        )

    return router
