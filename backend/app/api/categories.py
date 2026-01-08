from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import List
from app.api.deps import get_db
from app.models.category import Category
from app.schemas.category import CategoryResponse

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("/", response_model=List[CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    """Список активных категорий"""
    stmt = select(Category).where(Category.is_active == True).order_by(Category.sort_order)
    categories = db.exec(stmt).all()
    return categories







