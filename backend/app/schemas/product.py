from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal


class ProductImageResponse(BaseModel):
    id: int
    url: str
    alt: Optional[str] = None
    is_primary: bool
    sort_order: int

    class Config:
        from_attributes = True


class ProductResponse(BaseModel):
    """Карточка продукта в списке"""
    id: int
    name: str
    slug: str
    brand: Optional[str] = None
    sku: Optional[str] = None
    
    price: Decimal
    old_price: Optional[Decimal] = None
    final_price: Decimal
    discount_percent: Optional[int] = None
    
    in_stock: bool
    is_featured: bool
    is_active: bool = True
    
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    primary_image: Optional[str] = None

    class Config:
        from_attributes = True


class ProductDetailResponse(ProductResponse):
    """Детальная страница продукта"""
    description: Optional[str] = None
    sku: Optional[str] = None
    images: List[ProductImageResponse] = []
    category_name: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    """Пагинированный список"""
    items: List[ProductResponse]
    total: int
    page: int
    page_size: int
    pages: int
    min_price: Optional[Decimal] = None
    max_price: Optional[Decimal] = None


class ProductCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    price: Decimal
    old_price: Optional[Decimal] = None
    in_stock: bool = True
    sku: Optional[str] = None
    category_id: int
    brand: Optional[str] = None
    is_active: bool = True
    is_featured: bool = False


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    old_price: Optional[Decimal] = None
    in_stock: Optional[bool] = None
    sku: Optional[str] = None
    category_id: Optional[int] = None
    brand: Optional[str] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None


class ProductImageCreate(BaseModel):
    alt: Optional[str] = None
    sort_order: int = 0
    is_primary: bool = False


class ProductImageUpdate(BaseModel):
    alt: Optional[str] = None
    sort_order: Optional[int] = None
    is_primary: Optional[bool] = None


# Bulk operations
class BulkPriceUpdate(BaseModel):
    scope: str  # all, category, product_ids
    category_id: Optional[int] = None
    product_ids: Optional[List[int]] = None
    operation: str  # increase, decrease, set
    value_type: str  # percent, fixed
    value: Decimal


class BulkActiveUpdate(BaseModel):
    product_ids: List[int]
    is_active: bool


class BulkStockUpdate(BaseModel):
    updates: List[dict]  # [{product_id, stock_qty}]
