from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from enum import Enum

if TYPE_CHECKING:
    from .favorite import Favorite
    from .order import Order


class UserRole(str, Enum):
    CUSTOMER = "customer"
    MANAGER = "manager"
    ADMIN = "admin"


class User(SQLModel, table=True):
    __tablename__ = "users"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    email: Optional[str] = Field(default=None, unique=True, index=True)
    phone: Optional[str] = Field(default=None, unique=True, index=True)
    password_hash: str
    
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    
    role: UserRole = Field(default=UserRole.CUSTOMER)
    is_active: bool = Field(default=True)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    favorites: List["Favorite"] = Relationship(back_populates="user")
    orders: List["Order"] = Relationship(back_populates="user")






