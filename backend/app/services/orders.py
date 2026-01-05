from decimal import Decimal
from datetime import datetime
import secrets
from sqlmodel import Session, select
from fastapi import HTTPException
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.promotion import Promotion, PromotionType
from app.schemas.order import OrderCreate
from app.services.pricing import apply_promotions


def generate_order_number() -> str:
    """Генерация уникального номера заказа"""
    timestamp = datetime.utcnow().strftime("%y%m%d")
    random_part = secrets.token_hex(3).upper()
    return f"SP-{timestamp}-{random_part}"


def get_promotion_by_code(db: Session, code: str) -> Promotion | None:
    """Получить активную акцию по коду"""
    now = datetime.utcnow()
    
    stmt = select(Promotion).where(
        Promotion.code == code,
        Promotion.is_active == True,
        (Promotion.starts_at == None) | (Promotion.starts_at <= now),
        (Promotion.ends_at == None) | (Promotion.ends_at >= now),
    )
    
    return db.exec(stmt).first()


def calculate_promo_discount(subtotal: Decimal, promo: Promotion) -> Decimal:
    """Рассчитать скидку по промокоду"""
    if promo.type == PromotionType.PERCENT:
        return (subtotal * promo.value / 100).quantize(Decimal("0.01"))
    elif promo.type == PromotionType.FIXED:
        return min(promo.value, subtotal)
    return Decimal("0")


def create_order(db: Session, data: OrderCreate, user_id: int | None = None) -> Order:
    """Создание заказа"""
    
    # Проверяем товары и собираем items
    order_items = []
    subtotal = Decimal("0")
    
    for item_data in data.items:
        product = db.get(Product, item_data.product_id)
        
        if not product or not product.is_active:
            raise HTTPException(status_code=400, detail=f"Product {item_data.product_id} not found")
        
        # Проверяем наличие товара (если есть поле in_stock)
        if hasattr(product, 'in_stock') and not product.in_stock:
            raise HTTPException(
                status_code=400, 
                detail=f"Product {product.name} is out of stock"
            )
        
        # Рассчитываем финальную цену с учетом скидок и промоакций
        final_price, _ = apply_promotions(product, db)
        item_total = final_price * item_data.quantity
        
        order_items.append({
            "product_id": product.id,
            "product_name": product.name,
            "product_sku": product.sku,
            "quantity": item_data.quantity,
            "price": final_price,
            "total": item_total,
        })
        
        subtotal += item_total
    
    # Промокод
    discount = Decimal("0")
    if data.promotion_code:
        promo = get_promotion_by_code(db, data.promotion_code)
        if promo:
            discount = calculate_promo_discount(subtotal, promo)
    
    # Стоимость доставки
    # Бесплатная доставка при заказе от 1000 грн
    FREE_DELIVERY_THRESHOLD = Decimal("1000")
    if subtotal >= FREE_DELIVERY_THRESHOLD:
        delivery_cost = Decimal("0")
    else:
        # За тарифами Новой Почты (будет рассчитано при оформлении)
        delivery_cost = Decimal("0")
    
    # Итого
    total = subtotal - discount + delivery_cost
    
    # Создаём заказ
    order = Order(
        order_number=generate_order_number(),
        user_id=user_id,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        customer_email=data.customer_email,
        delivery_type=data.delivery_type,
        delivery_address=data.delivery_address,
        delivery_city=data.delivery_city,
        delivery_warehouse=data.delivery_warehouse,
        payment_type=data.payment_type,
        subtotal=subtotal,
        discount=discount,
        delivery_cost=delivery_cost,
        total=total,
        promotion_code=data.promotion_code,
        status=OrderStatus.PENDING,
        notes=data.notes,
    )
    
    db.add(order)
    db.commit()
    db.refresh(order)
    
    # Создаём items
    for item_data in order_items:
        item = OrderItem(order_id=order.id, **item_data)
        db.add(item)
    
    db.commit()
    db.refresh(order)
    
    return order





