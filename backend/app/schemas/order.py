from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from app.models.order import OrderStatus, DeliveryType, PaymentType


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int


class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    
    delivery_type: DeliveryType
    delivery_address: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_warehouse: Optional[str] = None
    
    payment_type: PaymentType
    promotion_code: Optional[str] = None
    notes: Optional[str] = None


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_sku: Optional[str] = None
    quantity: int
    price: Decimal
    total: Decimal

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int
    order_number: str
    
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    
    delivery_type: DeliveryType
    delivery_address: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_warehouse: Optional[str] = None
    
    payment_type: PaymentType
    is_paid: bool
    
    subtotal: Decimal
    discount: Decimal
    delivery_cost: Decimal
    total: Decimal
    
    promotion_code: Optional[str] = None
    status: OrderStatus
    notes: Optional[str] = None
    
    created_at: datetime
    items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    items: List[OrderResponse]
    total: int
    page: int
    page_size: int


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    is_paid: Optional[bool] = None






