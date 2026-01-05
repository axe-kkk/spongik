from pydantic_settings import BaseSettings
from typing import List, Optional
from datetime import timedelta


class Settings(BaseSettings):
    ENV: str = "development"
    SECRET_KEY: str = "change-me-in-production"
    DATABASE_URL: str = "sqlite:////data/sqlite.db"
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8080"
    
    # JWT
    JWT_ACCESS_EXPIRES_DAYS: int = 7
    
    # Admin seed
    ADMIN_EMAIL: Optional[str] = "admin@spongik.od"
    ADMIN_PHONE: Optional[str] = "+380000000000"
    ADMIN_PASSWORD: Optional[str] = None
    
    # Nova Poshta API (for frontend)
    NOVA_POSHTA_API_KEY: Optional[str] = None
    
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    @property
    def jwt_expires_delta(self) -> timedelta:
        return timedelta(days=self.JWT_ACCESS_EXPIRES_DAYS)
    
    class Config:
        env_file = ".env"


settings = Settings()

