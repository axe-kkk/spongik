from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlmodel import Session, select, col
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
import os
import uuid
import shutil
from math import ceil
from app.api.deps import get_db, admin_required
from app.models.user import User
from app.models.product import Product, ProductImage
from app.schemas.product import (
    ProductDetailResponse, ProductCreate, ProductUpdate,
    ProductImageResponse, ProductImageUpdate,
    BulkPriceUpdate, BulkActiveUpdate, BulkStockUpdate,
    ProductListResponse
)
from app.services.pricing import build_product_detail_response

router = APIRouter(prefix="/api/admin/products", tags=["admin-products"])

UPLOAD_DIR = "/data/uploads"


# === CRUD Products ===

@router.get("/", response_model=ProductListResponse)
def list_products(
    page: int = 1,
    page_size: int = 20,
    q: Optional[str] = Query(None, description="Search query"),
    category_id: Optional[int] = Query(None),
    in_stock: Optional[bool] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Все продукты (админ) с фильтрами"""
    stmt = select(Product)
    
    # Search
    if q:
        search = f"%{q}%"
        stmt = stmt.where(
            (col(Product.name).ilike(search)) |
            (col(Product.sku).ilike(search)) |
            (col(Product.brand).ilike(search))
        )
    
    # Category filter
    if category_id:
        stmt = stmt.where(Product.category_id == category_id)
    
    # Stock filter
    if in_stock is not None:
        stmt = stmt.where(Product.in_stock == in_stock)
    
    # Active filter
    if is_active is not None:
        stmt = stmt.where(Product.is_active == is_active)
    
    stmt = stmt.order_by(Product.id.desc())
    all_products = db.exec(stmt).all()
    total = len(all_products)
    
    offset = (page - 1) * page_size
    products = all_products[offset:offset + page_size]
    
    items = [build_product_detail_response(p, db) for p in products]
    
    return ProductListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if total > 0 else 1
    )


@router.get("/{product_id}", response_model=ProductDetailResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return build_product_detail_response(product, db)


@router.post("/", response_model=ProductDetailResponse)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    # Проверка slug
    existing = db.exec(select(Product).where(Product.slug == data.slug)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Slug already exists")
    
    # Проверка SKU
    if data.sku:
        existing_sku = db.exec(select(Product).where(Product.sku == data.sku)).first()
        if existing_sku:
            raise HTTPException(status_code=400, detail="SKU already exists")
    
    product = Product(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return build_product_detail_response(product, db)


@router.patch("/{product_id}", response_model=ProductDetailResponse)
def update_product(
    product_id: int,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = data.model_dump(exclude_unset=True)
    
    if "slug" in update_data:
        existing = db.exec(
            select(Product).where(Product.slug == update_data["slug"], Product.id != product_id)
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Slug already exists")
    
    if "sku" in update_data and update_data["sku"]:
        existing_sku = db.exec(
            select(Product).where(Product.sku == update_data["sku"], Product.id != product_id)
        ).first()
        if existing_sku:
            raise HTTPException(status_code=400, detail="SKU already exists")
    
    for key, value in update_data.items():
        setattr(product, key, value)
    
    product.updated_at = datetime.utcnow()
    db.add(product)
    db.commit()
    db.refresh(product)
    return build_product_detail_response(product, db)


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Удаляем изображения
    for img in product.images:
        filepath = os.path.join("/data", img.url.lstrip("/"))
        if os.path.exists(filepath):
            os.remove(filepath)
        db.delete(img)
    
    # Удаляем избранное
    for fav in product.favorites:
        db.delete(fav)
    
    db.delete(product)
    db.commit()
    return {"message": "Product deleted"}


# === Images ===

@router.post("/{product_id}/images", response_model=ProductImageResponse)
async def upload_image(
    product_id: int,
    file: UploadFile = File(...),
    alt: Optional[str] = Form(None),
    sort_order: int = Form(0),
    is_primary: bool = Form(False),
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Загрузить изображение товара"""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Создаём директорию
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    # Генерируем имя файла
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # Сохраняем файл
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Если is_primary — снимаем флаг с других
    if is_primary:
        for img in product.images:
            img.is_primary = False
            db.add(img)
    
    # Создаём запись
    image = ProductImage(
        product_id=product_id,
        url=f"/uploads/{filename}",
        alt=alt,
        sort_order=sort_order,
        is_primary=is_primary
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    
    return image


@router.patch("/{product_id}/images/{image_id}", response_model=ProductImageResponse)
def update_image(
    product_id: int,
    image_id: int,
    data: ProductImageUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Обновить метаданные изображения"""
    image = db.get(ProductImage, image_id)
    if not image or image.product_id != product_id:
        raise HTTPException(status_code=404, detail="Image not found")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Если is_primary — снимаем флаг с других
    if update_data.get("is_primary"):
        product = db.get(Product, product_id)
        for img in product.images:
            if img.id != image_id:
                img.is_primary = False
                db.add(img)
    
    for key, value in update_data.items():
        setattr(image, key, value)
    
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


@router.delete("/{product_id}/images/{image_id}")
def delete_image(
    product_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Удалить изображение"""
    image = db.get(ProductImage, image_id)
    if not image or image.product_id != product_id:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Удаляем файл
    filepath = os.path.join("/data", image.url.lstrip("/"))
    if os.path.exists(filepath):
        os.remove(filepath)
    
    db.delete(image)
    db.commit()
    return {"message": "Image deleted"}


# === Bulk Operations ===

@router.post("/bulk-price")
def bulk_price_update(
    data: BulkPriceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Массовое обновление цен"""
    stmt = select(Product)
    
    if data.scope == "category" and data.category_id:
        stmt = stmt.where(Product.category_id == data.category_id)
    elif data.scope == "product_ids" and data.product_ids:
        stmt = stmt.where(Product.id.in_(data.product_ids))
    # else: all products
    
    products = db.exec(stmt).all()
    updated = 0
    
    for product in products:
        old_price = product.price
        
        if data.operation == "set":
            if data.value_type == "fixed":
                product.price = data.value
            # percent для set не имеет смысла
        elif data.operation == "increase":
            if data.value_type == "percent":
                product.price = old_price * (1 + data.value / 100)
            else:
                product.price = old_price + data.value
        elif data.operation == "decrease":
            if data.value_type == "percent":
                product.price = old_price * (1 - data.value / 100)
            else:
                product.price = max(old_price - data.value, Decimal("0"))
        
        product.price = product.price.quantize(Decimal("0.01"))
        product.updated_at = datetime.utcnow()
        db.add(product)
        updated += 1
    
    db.commit()
    return {"message": f"Updated {updated} products"}


@router.post("/bulk-active")
def bulk_active_update(
    data: BulkActiveUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Массовое включение/выключение товаров"""
    stmt = select(Product).where(Product.id.in_(data.product_ids))
    products = db.exec(stmt).all()
    
    for product in products:
        product.is_active = data.is_active
        product.updated_at = datetime.utcnow()
        db.add(product)
    
    db.commit()
    return {"message": f"Updated {len(products)} products"}


@router.post("/bulk-stock")
def bulk_stock_update(
    data: BulkStockUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Массовое обновление наличия"""
    updated = 0
    
    for item in data.updates:
        product = db.get(Product, item.get("product_id"))
        if product:
            product.in_stock = item.get("in_stock", True)
            product.updated_at = datetime.utcnow()
            db.add(product)
            updated += 1
    
    db.commit()
    return {"message": f"Updated {updated} products"}

