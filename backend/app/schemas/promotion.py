from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from app.models.promotion import PromotionType, PromotionScope


class PromotionResponse(BaseModel):
    id: int
    code: Optional[str] = None
    name: str
    description: Optional[str] = None
    type: PromotionType
    scope: PromotionScope
    priority: int
    value: Decimal
    target_ids: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool

    class Config:
        from_attributes = True


class PromotionCreate(BaseModel):
    code: Optional[str] = None
    name: str
    description: Optional[str] = None
    type: PromotionType
    scope: PromotionScope = PromotionScope.ALL
    priority: int = 0
    value: Decimal
    target_ids: Optional[str] = None  # JSON: "[1,2,3]"
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool = True


class PromotionUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[PromotionType] = None
    scope: Optional[PromotionScope] = None
    priority: Optional[int] = None
    value: Optional[Decimal] = None
    target_ids: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: Optional[bool] = None







