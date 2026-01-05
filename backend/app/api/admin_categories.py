from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func
from typing import List
from app.api.deps import get_db, admin_required
from app.models.user import User
from app.models.category import Category
from app.models.product import Product
from app.schemas.category import CategoryResponse, CategoryCreate, CategoryUpdate

router = APIRouter(prefix="/api/admin/categories", tags=["admin-categories"])


@router.get("/")
def list_categories(
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Все категории с количеством товаров (админ)"""
    stmt = select(Category).order_by(Category.sort_order)
    categories = db.exec(stmt).all()
    
    result = []
    for cat in categories:
        # Считаем товары в категории
        count_stmt = select(func.count()).where(Product.category_id == cat.id)
        products_count = db.exec(count_stmt).one()
        
        result.append({
            "id": cat.id,
            "name": cat.name,
            "slug": cat.slug,
            "description": cat.description,
            "image_url": cat.image_url,
            "parent_id": cat.parent_id,
            "sort_order": cat.sort_order,
            "is_active": cat.is_active,
            "products_count": products_count
        })
    
    return result


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.post("/", response_model=CategoryResponse)
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    # Проверка slug
    existing = db.exec(select(Category).where(Category.slug == data.slug)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Slug already exists")
    
    # Проверка parent_id (если указан)
    if data.parent_id:
        parent = db.get(Category, data.parent_id)
        if not parent:
            raise HTTPException(status_code=400, detail="Parent category not found")
    
    category = Category(**data.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    data: CategoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Проверка: нельзя сделать категорию родителем самой себя
    if "parent_id" in update_data and update_data["parent_id"] == category_id:
        raise HTTPException(status_code=400, detail="Category cannot be its own parent")
    
    # Проверка: нельзя сделать родителем дочернюю категорию (циклическая зависимость)
    if "parent_id" in update_data and update_data["parent_id"]:
        # Проверяем, не является ли новый родитель дочерней категорией текущей
        def is_descendant(parent_id, child_id, db):
            """Проверяет, является ли child_id потомком parent_id"""
            child = db.get(Category, child_id)
            if not child or not child.parent_id:
                return False
            if child.parent_id == parent_id:
                return True
            return is_descendant(parent_id, child.parent_id, db)
        
        if is_descendant(category_id, update_data["parent_id"], db):
            raise HTTPException(status_code=400, detail="Cannot set a descendant category as parent")
    
    # Проверка slug
    if "slug" in update_data:
        existing = db.exec(
            select(Category).where(Category.slug == update_data["slug"], Category.id != category_id)
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Slug already exists")
    
    for key, value in update_data.items():
        setattr(category, key, value)
    
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    db.delete(category)
    db.commit()
    return {"message": "Category deleted"}

