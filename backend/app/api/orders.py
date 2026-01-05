from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, col
from typing import Optional, List
from datetime import datetime, date
from math import ceil
from app.api.deps import get_db, get_current_user, get_current_user_optional, admin_required
from app.models.user import User
from app.models.order import Order, OrderStatus, OrderItem
from app.models.product import Product
from app.schemas.order import OrderCreate, OrderResponse, OrderListResponse, OrderStatusUpdate, OrderItemResponse
from app.services.orders import create_order

router = APIRouter(tags=["orders"])


# === Public: создание заказа ===

@router.post("/api/orders", response_model=OrderResponse)
def create_new_order(
    data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional)
):
    """Создать заказ (гость или авторизованный)"""
    user_id = current_user.id if current_user else None
    order = create_order(db, data, user_id)
    return order


# === User: мои заказы ===

@router.get("/api/me/orders", response_model=List[OrderResponse])
def get_my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Список моих заказов"""
    stmt = select(Order).where(Order.user_id == current_user.id).order_by(Order.created_at.desc())
    orders = db.exec(stmt).all()
    return [build_order_response(order, db) for order in orders]


@router.get("/api/me/orders/{order_id}", response_model=OrderResponse)
def get_my_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Детали моего заказа"""
    order = db.get(Order, order_id)
    
    if not order or order.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return build_order_response(order, db)


# === Admin: управление заказами ===

@router.get("/api/admin/orders", response_model=OrderListResponse)
def admin_list_orders(
    status: Optional[OrderStatus] = Query(None),
    phone: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Список заказов с фильтрами (админ)"""
    stmt = select(Order)
    
    if status:
        stmt = stmt.where(Order.status == status)
    
    if phone:
        # Поиск по телефону или номеру заказа
        stmt = stmt.where(
            (col(Order.customer_phone).contains(phone)) |
            (col(Order.order_number).contains(phone))
        )
    
    if date_from:
        stmt = stmt.where(Order.created_at >= datetime.combine(date_from, datetime.min.time()))
    
    if date_to:
        stmt = stmt.where(Order.created_at <= datetime.combine(date_to, datetime.max.time()))
    
    stmt = stmt.order_by(Order.created_at.desc())
    
    # Total count
    all_orders = db.exec(stmt).all()
    total = len(all_orders)
    
    # Pagination
    offset = (page - 1) * page_size
    orders = all_orders[offset:offset + page_size]
    
    # Строим ответы с изображениями товаров
    orders_with_images = [build_order_response(order, db) for order in orders]
    
    return OrderListResponse(
        items=orders_with_images,
        total=total,
        page=page,
        page_size=page_size
    )


def build_order_response(order: Order, db: Session) -> dict:
    """Построить ответ заказа с изображениями товаров"""
    order_dict = order.model_dump()
    
    # Получаем изображения товаров для каждого элемента заказа
    items_with_images = []
    for item in order.items:
        item_dict = item.model_dump()
        
        # Получаем изображение товара
        product = db.get(Product, item.product_id)
        if product:
            # Находим primary image или первое изображение
            primary_image = None
            for img in product.images:
                if img.is_primary:
                    primary_image = img.url
                    break
            if not primary_image and product.images:
                primary_image = product.images[0].url
            item_dict['product_image'] = primary_image
        else:
            item_dict['product_image'] = None
        
        items_with_images.append(OrderItemResponse(**item_dict))
    
    order_dict['items'] = items_with_images
    return OrderResponse(**order_dict)


@router.get("/api/admin/orders/{order_id}", response_model=OrderResponse)
def admin_get_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Детали заказа (админ)"""
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return build_order_response(order, db)


@router.patch("/api/admin/orders/{order_id}", response_model=OrderResponse)
def admin_update_order(
    order_id: int,
    data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Обновить статус заказа (админ)"""
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = data.status
    order.updated_at = datetime.utcnow()
    
    if data.is_paid is not None:
        order.is_paid = data.is_paid
    
    db.add(order)
    db.commit()
    db.refresh(order)
    
    return order
