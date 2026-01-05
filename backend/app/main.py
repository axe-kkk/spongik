from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(
    title="Spongik API",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers after app creation to avoid circular imports
from app.api import (
    auth,
    users,
    categories,
    products,
    promotions,
    orders,
    favorites,
    admin_categories,
    admin_products,
    admin_stats
)

# Routers - all already have /api prefix
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(promotions.router)
app.include_router(orders.router)
app.include_router(favorites.router)
app.include_router(admin_categories.router)
app.include_router(admin_products.router)
app.include_router(admin_stats.router)

# Static files for uploads
# Create directory if it doesn't exist
os.makedirs("/data/uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/data/uploads"), name="uploads")


@app.get("/")
def root():
    return {"status": "ok", "service": "spongik-api"}


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "env": settings.ENV
    }

