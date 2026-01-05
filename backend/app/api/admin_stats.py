from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func, and_
from datetime import datetime, timedelta, date as date_type
from decimal import Decimal
from typing import List
from pydantic import BaseModel
from app.api.deps import get_db, admin_required
from app.models.user import User
from app.models.order import Order, OrderStatus, OrderItem

router = APIRouter(prefix="/api/admin/stats", tags=["admin-stats"])


class TopProduct(BaseModel):
    name: str
    total_qty: int


class SalesByDay(BaseModel):
    date: str
    revenue: float


class StatsResponse(BaseModel):
    orders_today: int
    orders_month: int
    revenue_today: float
    revenue_month: float
    top_products_qty: List[TopProduct]
    sales_by_day: List[SalesByDay]


@router.get("/", response_model=StatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Статистика для админ-панели"""
    today = date_type.today()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    
    # Начало и конец текущего месяца
    month_start = datetime(today.year, today.month, 1)
    if today.month == 12:
        month_end = datetime(today.year + 1, 1, 1) - timedelta(seconds=1)
    else:
        month_end = datetime(today.year, today.month + 1, 1) - timedelta(seconds=1)
    
    # Статусы, которые считаем в статистике (исключаем отмененные и возвращенные)
    active_statuses = [
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
    ]
    
    # Заказы за сегодня (активные)
    today_orders_stmt = select(func.count(Order.id)).where(
        and_(
            Order.created_at >= today_start,
            Order.created_at <= today_end,
            Order.status.in_(active_statuses)
        )
    )
    orders_today = db.exec(today_orders_stmt).one() or 0
    
    # Выручка за сегодня (активные заказы)
    today_revenue_stmt = select(func.sum(Order.total)).where(
        and_(
            Order.created_at >= today_start,
            Order.created_at <= today_end,
            Order.status.in_(active_statuses)
        )
    )
    revenue_today_result = db.exec(today_revenue_stmt).one()
    revenue_today = float(revenue_today_result) if revenue_today_result else 0.0
    
    # Заказы за месяц (активные)
    month_orders_stmt = select(func.count(Order.id)).where(
        and_(
            Order.created_at >= month_start,
            Order.created_at <= month_end,
            Order.status.in_(active_statuses)
        )
    )
    orders_month = db.exec(month_orders_stmt).one() or 0
    
    # Выручка за месяц (активные заказы)
    month_revenue_stmt = select(func.sum(Order.total)).where(
        and_(
            Order.created_at >= month_start,
            Order.created_at <= month_end,
            Order.status.in_(active_statuses)
        )
    )
    revenue_month_result = db.exec(month_revenue_stmt).one()
    revenue_month = float(revenue_month_result) if revenue_month_result else 0.0
    
    # Статистика по дням за последние 7 дней (для графика)
    sales_by_day = []
    for i in range(6, -1, -1):  # Последние 7 дней, включая сегодня
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())
        
        day_revenue_stmt = select(func.sum(Order.total)).where(
            and_(
                Order.created_at >= day_start,
                Order.created_at <= day_end,
                Order.status.in_(active_statuses)
            )
        )
        day_revenue_result = db.exec(day_revenue_stmt).one()
        day_revenue = float(day_revenue_result) if day_revenue_result else 0.0
        
        sales_by_day.append(
            SalesByDay(
                date=day.isoformat(),
                revenue=day_revenue
            )
        )
    
    # Топ товаров по количеству проданных единиц
    # Считаем только для активных заказов
    active_order_ids_stmt = select(Order.id).where(
        Order.status.in_(active_statuses)
    )
    active_order_ids = [order_id for order_id in db.exec(active_order_ids_stmt).all()]
    
    if active_order_ids:
        # Получаем топ товаров через OrderItem.product_name (сохраняется на момент заказа)
        top_products_stmt = (
            select(
                OrderItem.product_name,
                func.sum(OrderItem.quantity).label("total_qty")
            )
            .where(OrderItem.order_id.in_(active_order_ids))
            .group_by(OrderItem.product_name)
            .order_by(func.sum(OrderItem.quantity).desc())
            .limit(10)
        )
        top_products = db.exec(top_products_stmt).all()
        top_products_qty = [
            TopProduct(name=row[0], total_qty=int(row[1]))
            for row in top_products
        ]
    else:
        top_products_qty = []
    
    return StatsResponse(
        orders_today=orders_today,
        orders_month=orders_month,
        revenue_today=revenue_today,
        revenue_month=revenue_month,
        top_products_qty=top_products_qty,
        sales_by_day=sales_by_day
    )
