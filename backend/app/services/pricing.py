from decimal import Decimal
from datetime import datetime
from typing import Optional, Tuple, List
from sqlmodel import Session, select
from app.models.product import Product
from app.models.promotion import Promotion, PromotionType, PromotionScope


# Приоритет scope: product > category > all
SCOPE_PRIORITY = {
    PromotionScope.PRODUCT: 3,
    PromotionScope.CATEGORY: 2,
    PromotionScope.ALL: 1,
}


def get_active_promotions(db: Session) -> List[Promotion]:
    """Получить все активные акции"""
    now = datetime.utcnow()
    
    stmt = select(Promotion).where(
        Promotion.is_active == True,
        (Promotion.starts_at == None) | (Promotion.starts_at <= now),
        (Promotion.ends_at == None) | (Promotion.ends_at >= now),
    )
    
    return list(db.exec(stmt).all())


def get_applicable_promotions(product: Product, promotions: List[Promotion]) -> List[Promotion]:
    """Фильтровать акции применимые к продукту"""
    applicable = []
    
    for promo in promotions:
        if promo.scope == PromotionScope.ALL:
            applicable.append(promo)
        elif promo.scope == PromotionScope.CATEGORY and product.category_id:
            if promo.target_ids and str(product.category_id) in promo.target_ids:
                applicable.append(promo)
        elif promo.scope == PromotionScope.PRODUCT:
            if promo.target_ids and str(product.id) in promo.target_ids:
                applicable.append(promo)
    
    return applicable


def calculate_discount(base_price: Decimal, promo: Promotion) -> Decimal:
    """Рассчитать цену после применения акции"""
    if promo.type == PromotionType.PERCENT:
        discount = base_price * (promo.value / 100)
        return base_price - discount
    elif promo.type == PromotionType.FIXED:
        return max(base_price - promo.value, Decimal("0"))
    return base_price


def select_best_promotion(base_price: Decimal, promotions: List[Promotion]) -> Optional[Promotion]:
    """
    Выбрать лучшую акцию по правилу:
    1. Сначала по scope (product > category > all)
    2. Затем по priority (выше = важнее)
    3. При равенстве — максимальная выгода
    """
    if not promotions:
        return None
    
    # Группируем по scope priority
    by_scope = {}
    for promo in promotions:
        sp = SCOPE_PRIORITY[promo.scope]
        if sp not in by_scope:
            by_scope[sp] = []
        by_scope[sp].append(promo)
    
    # Берём группу с максимальным scope priority
    max_scope = max(by_scope.keys())
    candidates = by_scope[max_scope]
    
    # В группе берём с максимальным priority
    max_priority = max(p.priority for p in candidates)
    candidates = [p for p in candidates if p.priority == max_priority]
    
    # Если несколько — выбираем максимальную выгоду
    best = None
    best_price = base_price
    
    for promo in candidates:
        new_price = calculate_discount(base_price, promo)
        if new_price < best_price:
            best_price = new_price
            best = promo
    
    return best


def apply_promotions(product: Product, db: Session = None) -> Tuple[Decimal, Optional[int]]:
    """
    Рассчитать финальную цену с учётом акций.
    Возвращает (final_price, discount_percent)
    """
    base_price = product.price
    
    # Если есть old_price — это уже скидка на товаре
    if product.old_price and product.old_price > product.price:
        discount_percent = int(((product.old_price - product.price) / product.old_price) * 100)
        return product.price, discount_percent
    
    # Если передана сессия — ищем активные промоакции
    if db:
        all_promotions = get_active_promotions(db)
        applicable = get_applicable_promotions(product, all_promotions)
        best_promo = select_best_promotion(base_price, applicable)
        
        if best_promo:
            final_price = calculate_discount(base_price, best_promo)
            discount_percent = int(((base_price - final_price) / base_price) * 100)
            return final_price.quantize(Decimal("0.01")), discount_percent
    
    return base_price, None


def build_product_response(product: Product, db: Session) -> dict:
    """Построить ответ продукта с вычисленными полями"""
    final_price, discount_percent = apply_promotions(product, db)
    
    # Найти primary image
    primary_image = None
    for img in product.images:
        if img.is_primary:
            primary_image = img.url
            break
    if not primary_image and product.images:
        primary_image = product.images[0].url
    
    return {
        "id": product.id,
        "name": product.name,
        "slug": product.slug,
        "brand": product.brand,
        "price": float(product.price) if product.price else None,
        "old_price": float(product.old_price) if product.old_price else None,
        "final_price": float(final_price) if final_price else None,
        "discount_percent": discount_percent,
        "in_stock": product.in_stock,
        "is_featured": product.is_featured,
        "is_active": product.is_active,
        "category_id": product.category_id,
        "category_name": product.category.name if product.category else None,
        "sku": product.sku,
        "primary_image": primary_image,
    }


def build_product_detail_response(product: Product, db: Session) -> dict:
    """Построить детальный ответ продукта"""
    base = build_product_response(product, db)
    
    base.update({
        "description": product.description,
        "sku": product.sku,
        "images": [
            {
                "id": img.id,
                "url": img.url,
                "alt": img.alt,
                "is_primary": img.is_primary,
                "sort_order": img.sort_order,
            }
            for img in sorted(product.images, key=lambda x: (not x.is_primary, x.sort_order))
        ],
        "category_name": product.category.name if product.category else None,
        "is_active": product.is_active,
    })
    
    return base

