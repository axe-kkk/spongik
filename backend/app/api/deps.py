from fastapi import Depends, HTTPException, status, Request
from fastapi_jwt import JwtAccessBearerCookie, JwtAuthorizationCredentials
from sqlmodel import Session, select
from app.db.session import engine
from app.models.user import User, UserRole
from app.core.config import settings

# JWT с HttpOnly cookie
access_security = JwtAccessBearerCookie(
    secret_key=settings.SECRET_KEY,
    auto_error=False
)


def get_db():
    with Session(engine) as session:
        yield session


async def get_current_user(
    credentials: JwtAuthorizationCredentials = Depends(access_security),
    db: Session = Depends(get_db)
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    user_id = credentials.subject.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    user = db.get(User, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    return user


async def get_current_user_optional(
    credentials: JwtAuthorizationCredentials = Depends(access_security),
    db: Session = Depends(get_db)
) -> User | None:
    if credentials is None:
        return None
    
    user_id = credentials.subject.get("id")
    if not user_id:
        return None
    
    return db.get(User, int(user_id))


async def admin_required(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

