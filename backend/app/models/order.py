from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from decimal import Decimal
from enum import Enum

if TYPE_CHECKING:
    from .user import User
    from .product import Product


class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class DeliveryType(str, Enum):
    PICKUP = "pickup"
    NOVA_POSHTA = "nova_poshta"
    COURIER = "courier"


class PaymentType(str, Enum):
    CASH = "cash"
    CARD_ON_DELIVERY = "card_on_delivery"
    ONLINE = "online"


class Order(SQLModel, table=True):
    __tablename__ = "orders"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    order_number: str = Field(unique=True, index=True)
    
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    
    # Контакты (для гостевых заказов)
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    
    # Доставка
    delivery_type: DeliveryType
    delivery_address: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_warehouse: Optional[str] = None  # Для Новой Почты
    
    # Оплата
    payment_type: PaymentType
    is_paid: bool = Field(default=False)
    
    # Суммы
    subtotal: Decimal = Field(max_digits=10, decimal_places=2)
    discount: Decimal = Field(default=Decimal("0"), max_digits=10, decimal_places=2)
    delivery_cost: Decimal = Field(default=Decimal("0"), max_digits=10, decimal_places=2)
    total: Decimal = Field(max_digits=10, decimal_places=2)
    
    promotion_code: Optional[str] = None
    
    status: OrderStatus = Field(default=OrderStatus.PENDING)
    notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    user: Optional["User"] = Relationship(back_populates="orders")
    items: List["OrderItem"] = Relationship(back_populates="order")


class OrderItem(SQLModel, table=True):
    __tablename__ = "order_items"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="orders.id", index=True)
    product_id: int = Field(foreign_key="products.id")
    
    product_name: str  # Сохраняем на момент заказа
    product_sku: Optional[str] = None
    
    quantity: int
    price: Decimal = Field(max_digits=10, decimal_places=2)  # Цена на момент заказа
    total: Decimal = Field(max_digits=10, decimal_places=2)
    
    # Relationships
    order: Optional["Order"] = Relationship(back_populates="items")
    product: Optional["Product"] = Relationship(back_populates="order_items")







