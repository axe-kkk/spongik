from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from pydantic import BaseModel
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.favorite import Favorite
from app.models.product import Product
from app.services.pricing import build_product_response
from app.schemas.product import ProductResponse

router = APIRouter(prefix="/api/me/favorites", tags=["favorites"])


class FavoriteAdd(BaseModel):
    product_id: int


@router.get("/", response_model=List[ProductResponse])
def get_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Список избранных товаров"""
    stmt = select(Favorite).where(Favorite.user_id == current_user.id)
    favorites = db.exec(stmt).all()
    
    products = []
    for fav in favorites:
        if fav.product and fav.product.is_active:
            products.append(build_product_response(fav.product, db))
    
    return products


@router.post("/", response_model=ProductResponse)
def add_favorite(
    data: FavoriteAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Добавить в избранное"""
    product = db.get(Product, data.product_id)
    if not product or not product.is_active:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Проверяем дубликат
    existing = db.exec(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.product_id == data.product_id
        )
    ).first()
    
    if existing:
        return build_product_response(product, db)
    
    favorite = Favorite(user_id=current_user.id, product_id=data.product_id)
    db.add(favorite)
    db.commit()
    
    return build_product_response(product, db)


@router.delete("/{product_id}")
def remove_favorite(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить из избранного"""
    favorite = db.exec(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.product_id == product_id
        )
    ).first()
    
    if not favorite:
        raise HTTPException(status_code=404, detail="Favorite not found")
    
    db.delete(favorite)
    db.commit()
    
    return {"message": "Removed from favorites"}







