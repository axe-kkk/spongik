from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlmodel import Session, select
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.api.deps import get_db, access_security, get_current_user
from app.models.user import User, UserRole
from app.core.security import hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


# === Schemas ===

class RegisterRequest(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class LoginRequest(BaseModel):
    login: str  # email или phone
    password: str


class UserResponse(BaseModel):
    id: int
    email: Optional[str]
    phone: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    role: UserRole

    class Config:
        from_attributes = True


# === Routes ===

@router.post("/register", response_model=UserResponse)
def register(data: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    # Валидация: нужен email или phone
    if not data.email and not data.phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or phone required"
        )
    
    # Проверка уникальности
    if data.email:
        existing = db.exec(select(User).where(User.email == data.email)).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    
    if data.phone:
        existing = db.exec(select(User).where(User.phone == data.phone)).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone already registered"
            )
    
    # Создание пользователя
    user = User(
        email=data.email,
        phone=data.phone,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=UserRole.CUSTOMER
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Установка JWT cookie
    subject = {"id": user.id, "role": user.role.value}
    access_token = access_security.create_access_token(subject=subject)
    access_security.set_access_cookie(response, access_token)
    
    return user


@router.post("/login", response_model=UserResponse)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    # Поиск по email или phone
    user = db.exec(
        select(User).where(
            (User.email == data.login) | (User.phone == data.login)
        )
    ).first()
    
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    # Установка JWT cookie
    subject = {"id": user.id, "role": user.role.value}
    access_token = access_security.create_access_token(subject=subject)
    access_security.set_access_cookie(response, access_token)
    
    return user


@router.post("/logout")
def logout(response: Response):
    access_security.unset_access_cookie(response)
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user







