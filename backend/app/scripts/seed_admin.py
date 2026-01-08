"""
Seed-скрипт: создание админа из ENV если не существует
Запуск: python -m app.scripts.seed_admin
"""
from sqlmodel import SQLModel, Session, select
from app.db.session import engine
from app.models.user import User, UserRole
from app.core.security import hash_password
from app.core.config import settings


def create_tables():
    """Создание всех таблиц"""
    SQLModel.metadata.create_all(engine)


def seed_admin():
    """Создание админа если не существует"""
    admin_email = settings.ADMIN_EMAIL
    admin_phone = settings.ADMIN_PHONE
    admin_password = settings.ADMIN_PASSWORD
    
    if not admin_password:
        print("ADMIN_PASSWORD not set, skipping admin seed")
        return
    
    with Session(engine) as session:
        # Проверяем существует ли админ
        stmt = select(User).where(
            (User.email == admin_email) | (User.phone == admin_phone)
        )
        existing = session.exec(stmt).first()
        
        if existing:
            print(f"Admin already exists: {existing.email or existing.phone}")
            return
        
        # Создаём админа
        admin = User(
            email=admin_email,
            phone=admin_phone,
            password_hash=hash_password(admin_password),
            first_name="Admin",
            role=UserRole.ADMIN,
            is_active=True
        )
        session.add(admin)
        session.commit()
        print(f"Admin created: {admin_email or admin_phone}")


def main():
    print("Creating tables...")
    create_tables()
    print("Seeding admin...")
    seed_admin()
    print("Done!")


if __name__ == "__main__":
    main()







