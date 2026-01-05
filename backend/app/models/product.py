from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from decimal import Decimal

if TYPE_CHECKING:
    from .category import Category
    from .favorite import Favorite
    from .order import OrderItem


class Product(SQLModel, table=True):
    __tablename__ = "products"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    slug: str = Field(unique=True, index=True)
    description: Optional[str] = None
    
    price: Decimal = Field(max_digits=10, decimal_places=2)
    old_price: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=2)
    
    in_stock: bool = Field(default=True)
    sku: Optional[str] = Field(default=None, unique=True)
    
    category_id: Optional[int] = Field(default=None, foreign_key="categories.id")
    brand: Optional[str] = None
    
    is_active: bool = Field(default=True)
    is_featured: bool = Field(default=False)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    category: Optional["Category"] = Relationship(back_populates="products")
    images: List["ProductImage"] = Relationship(back_populates="product")
    favorites: List["Favorite"] = Relationship(back_populates="product")
    order_items: List["OrderItem"] = Relationship(back_populates="product")


class ProductImage(SQLModel, table=True):
    __tablename__ = "product_images"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="products.id")
    url: str
    alt: Optional[str] = None
    sort_order: int = Field(default=0)
    is_primary: bool = Field(default=False)
    
    # Relationships
    product: Optional["Product"] = Relationship(back_populates="images")

