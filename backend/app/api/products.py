from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlmodel import Session, select, col, or_
from typing import Optional, Literal, List
from decimal import Decimal
from math import ceil
import logging
from app.api.deps import get_db
from app.models.product import Product
from app.models.category import Category
from app.schemas.product import ProductResponse, ProductListResponse, ProductDetailResponse
from app.services.pricing import build_product_response, build_product_detail_response

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/", response_model=ProductListResponse)
def list_products(
    request: Request,
    q: Optional[str] = Query(None, description="Search query"),
    min_price: Optional[Decimal] = Query(None),
    max_price: Optional[Decimal] = Query(None),
    in_stock: Optional[bool] = Query(None),
    on_sale: Optional[bool] = Query(None),
    sort: Literal["price_asc", "price_desc", "newest", "name"] = Query("newest"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Список продуктов с фильтрами"""
    stmt = select(Product).where(Product.is_active == True)
    
    # Получаем категории напрямую из query параметров (поддержка множественных значений)
    category_slugs = request.query_params.getlist("category")
    
    # Фильтр по категориям (поддержка множественного выбора)
    if category_slugs and len(category_slugs) > 0:
        # Получаем все категории по их slug
        cats = db.exec(select(Category).where(col(Category.slug).in_(category_slugs))).all()
        if cats:
            category_ids = set()
            selected_cat_ids = {cat.id for cat in cats}
            
            # Для каждой выбранной категории
            for cat in cats:
                category_ids.add(cat.id)
                
                # Если это родительская категория (не дочерняя), добавляем все её дочерние
                # Проверяем, что это не дочерняя категория (нет родителя среди выбранных)
                is_parent = not cat.parent_id or cat.parent_id not in selected_cat_ids
                
                if is_parent:
                    # Рекурсивно получаем все дочерние категории
                    def get_all_children(parent_id):
                        children = db.exec(select(Category).where(Category.parent_id == parent_id)).all()
                        for child in children:
                            category_ids.add(child.id)
                            get_all_children(child.id)
                    
                    get_all_children(cat.id)
            
            if len(category_ids) > 0:
                # Используем .in_() для множественного выбора - это работает как OR
                stmt = stmt.where(Product.category_id.in_(list(category_ids)))
    
    # Поиск
    if q:
        search = f"%{q}%"
        stmt = stmt.where(
            (col(Product.name).ilike(search)) |
            (col(Product.brand).ilike(search)) |
            (col(Product.description).ilike(search))
        )
    
    # Фильтр по цене - применяем после получения данных, так как final_price вычисляется динамически
    # Не применяем фильтр по цене в SQL, будем фильтровать после вычисления final_price
    
    # В наличии
    if in_stock is True:
        stmt = stmt.where(Product.in_stock == True)
    
    # Со скидкой - фильтруем после получения данных, так как нужно проверить и промоакции
    # Пока получаем все товары, фильтр применим позже
    
    # Сортировка
    if sort == "price_asc":
        stmt = stmt.order_by(Product.price.asc())
    elif sort == "price_desc":
        stmt = stmt.order_by(Product.price.desc())
    elif sort == "name":
        stmt = stmt.order_by(Product.name.asc())
    else:  # newest
        stmt = stmt.order_by(Product.created_at.desc())
    
    # Получаем минимальную и максимальную цены всех активных товаров (без фильтров)
    all_active_products = db.exec(select(Product).where(Product.is_active == True)).all()
    min_price_db = None
    max_price_db = None
    if all_active_products:
        prices = [float(p.price) for p in all_active_products if p.price]
        if prices:
            min_price_db = Decimal(str(min(prices)))
            max_price_db = Decimal(str(max(prices)))
    
    # Получаем все товары после применения фильтров (кроме цены)
    all_filtered = db.exec(stmt).all()
    
    # Фильтруем по финальной цене и скидке (если заданы фильтры)
    if min_price is not None or max_price is not None or on_sale is True:
        from app.services.pricing import apply_promotions
        filtered_products = []
        for p in all_filtered:
            final_price, discount_percent = apply_promotions(p, db)
            
            # Фильтр по цене
            if min_price is not None and final_price < min_price:
                continue
            if max_price is not None and final_price > max_price:
                continue
            
            # Фильтр "со скидкой" - проверяем old_price или наличие промоакции
            if on_sale is True:
                has_discount = (p.old_price is not None and p.old_price > p.price) or discount_percent is not None
                if not has_discount:
                    continue
            
            filtered_products.append(p)
        all_filtered = filtered_products
    
    total = len(all_filtered)
    
    # Пагинация
    offset = (page - 1) * page_size
    products = all_filtered[offset:offset + page_size]
    
    # Формируем ответ
    items = [build_product_response(p, db) for p in products]
    
    return ProductListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if total > 0 else 1,
        min_price=min_price_db,
        max_price=max_price_db
    )


@router.get("/{slug}", response_model=ProductDetailResponse)
def get_product(slug: str, db: Session = Depends(get_db)):
    """Получить продукт по slug"""
    product = db.exec(
        select(Product).where(Product.slug == slug, Product.is_active == True)
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return build_product_detail_response(product, db)

