from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List
from datetime import datetime
from app.api.deps import get_db, admin_required
from app.models.user import User
from app.models.promotion import Promotion
from app.schemas.promotion import PromotionResponse, PromotionCreate, PromotionUpdate

router = APIRouter(prefix="/api/promotions", tags=["promotions"])


# === Public ===

@router.get("/active", response_model=List[PromotionResponse])
def list_active_promotions(db: Session = Depends(get_db)):
    """Список активных акций (публичный)"""
    now = datetime.utcnow()
    
    stmt = select(Promotion).where(
        Promotion.is_active == True,
        (Promotion.starts_at == None) | (Promotion.starts_at <= now),
        (Promotion.ends_at == None) | (Promotion.ends_at >= now),
    ).order_by(Promotion.priority.desc())
    
    return db.exec(stmt).all()


# === Admin CRUD ===

@router.get("/", response_model=List[PromotionResponse])
def list_promotions(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Список всех акций (админ)"""
    stmt = select(Promotion).offset(skip).limit(limit).order_by(Promotion.id.desc())
    return db.exec(stmt).all()


@router.get("/{promotion_id}", response_model=PromotionResponse)
def get_promotion(
    promotion_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Получить акцию по ID (админ)"""
    promo = db.get(Promotion, promotion_id)
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    return promo


@router.post("/", response_model=PromotionResponse)
def create_promotion(
    data: PromotionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Создать акцию (админ)"""
    # Проверка уникальности code
    if data.code:
        existing = db.exec(select(Promotion).where(Promotion.code == data.code)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Promotion code already exists")
    
    promo = Promotion(**data.model_dump())
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return promo


@router.patch("/{promotion_id}", response_model=PromotionResponse)
def update_promotion(
    promotion_id: int,
    data: PromotionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Обновить акцию (админ)"""
    promo = db.get(Promotion, promotion_id)
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Проверка уникальности code
    if "code" in update_data and update_data["code"]:
        existing = db.exec(
            select(Promotion).where(
                Promotion.code == update_data["code"],
                Promotion.id != promotion_id
            )
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Promotion code already exists")
    
    for key, value in update_data.items():
        setattr(promo, key, value)
    
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return promo


@router.delete("/{promotion_id}")
def delete_promotion(
    promotion_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required)
):
    """Удалить акцию (админ)"""
    promo = db.get(Promotion, promotion_id)
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    
    db.delete(promo)
    db.commit()
    return {"message": "Promotion deleted"}







