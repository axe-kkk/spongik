# Spongik — Korean Beauty E-commerce

Премиальный интернет-магазин корейской косметики.

## 🚀 Быстрый старт

### С Docker (рекомендуется)

```bash
# 1. Клонировать и перейти в папку
cd spongik.od

# 2. Создать .env файл
cp env.example.txt .env

# 3. Запустить
docker-compose up --build

# Frontend: http://localhost
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Без Docker (development)

**Backend:**
```bash
cd backend

# Создать виртуальное окружение
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Установить зависимости
pip install -r requirements.txt

# Создать папку для БД
mkdir -p /data

# Запустить seed и сервер
python -m app.scripts.seed_admin
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
# Просто открыть в браузере или использовать live server
cd frontend
# Открыть pages/index.html в браузере
```

## 📁 Структура проекта

```
spongik.od/
├── backend/
│   ├── app/
│   │   ├── api/          # API роуты
│   │   ├── core/         # Конфиг, безопасность
│   │   ├── db/           # База данных
│   │   ├── models/       # SQLModel модели
│   │   ├── schemas/      # Pydantic схемы
│   │   ├── services/     # Бизнес-логика
│   │   └── scripts/      # Seed скрипты
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── admin/            # Админ-панель
│   ├── assets/
│   │   ├── css/          # Стили
│   │   └── js/           # JavaScript модули
│   └── pages/            # HTML страницы
└── docker-compose.yml
```

## 🔑 API Endpoints

### Public
- `GET /api/categories` — категории
- `GET /api/products` — товары с фильтрами
- `GET /api/products/{slug}` — детали товара
- `GET /api/promotions/active` — активные акции
- `POST /api/orders` — создать заказ

### Auth
- `POST /api/auth/register` — регистрация
- `POST /api/auth/login` — вход
- `POST /api/auth/logout` — выход
- `GET /api/auth/me` — текущий пользователь

### User
- `GET /api/me/favorites` — избранное
- `GET /api/me/orders` — мои заказы

### Admin
- `GET /api/admin/stats` — статистика
- `GET /api/admin/orders` — все заказы
- `CRUD /api/admin/products` — товары
- `CRUD /api/admin/categories` — категории
- `CRUD /api/admin/promotions` — акции

## 🎨 Дизайн-система

**Цвета:**
- Cream: `#F3EBD8` — основной фон
- Pink: `#F297A0` — акцент/CTA
- Matcha: `#B6BB79` — eco/trust блоки
- Text: `#2B2B2B` / `#6B6B6B`

**Шрифты:**
- Заголовки: Tenor Sans
- Текст: Manrope

## 👤 Доступ к админке

После запуска:
- URL: http://localhost/admin
- Email: admin@spongik.od
- Пароль: admin123 (из .env)

## 📝 Лицензия

MIT





