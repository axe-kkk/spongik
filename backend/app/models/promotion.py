from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal
from enum import Enum


class PromotionType(str, Enum):
    PERCENT = "percent"
    FIXED = "fixed"


class PromotionScope(str, Enum):
    ALL = "all"
    CATEGORY = "category"
    PRODUCT = "product"


class Promotion(SQLModel, table=True):
    __tablename__ = "promotions"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    code: Optional[str] = Field(default=None, unique=True, index=True)
    name: str
    description: Optional[str] = None
    
    type: PromotionType
    scope: PromotionScope = Field(default=PromotionScope.ALL)
    priority: int = Field(default=0)  # Выше = важнее
    
    # Значение скидки (процент или фикс. сумма)
    value: Decimal = Field(max_digits=10, decimal_places=2)
    
    # Привязка к категории/продукту (JSON array of ids)
    target_ids: Optional[str] = None
    
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool = Field(default=True)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

