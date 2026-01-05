# Инструкция по развертыванию Spongik

## Подготовка сервера

### Требования
- Docker и Docker Compose установлены
- Минимум 1 GB RAM
- Минимум 2 GB свободного места на диске
- Порт 80 (HTTP) и 443 (HTTPS) открыты

### Рекомендуемая конфигурация
- Ubuntu 20.04+ или Debian 11+
- 2 CPU cores
- 2 GB RAM
- 10 GB диск

## Установка

### 1. Подготовка файлов

```bash
# Склонировать репозиторий
git clone <repository-url>
cd spongik.od

# Создать .env файл из примера
cp env.example.txt .env
```

### 2. Настройка переменных окружения

Отредактируйте файл `.env` и укажите ваши значения:

```bash
nano .env
```

**Обязательные параметры:**

- `SECRET_KEY` - случайная строка минимум 32 символа (для безопасности)
- `CORS_ORIGINS` - домены вашего сайта через запятую
- `ADMIN_EMAIL` - email администратора
- `ADMIN_PASSWORD` - пароль администратора (минимум 8 символов)
- `DATABASE_URL` - URL базы данных (по умолчанию SQLite)

**Опциональные параметры:**

- `NOVA_POSHTA_API_KEY` - API ключ Новой Почты (для автозаполнения адресов)
- `ENV` - окружение (production/development)
- `ADMIN_PHONE` - телефон администратора

**Пример .env:**

```env
ENV=production
SECRET_KEY=your-super-secret-key-min-32-characters-long-random-string
DATABASE_URL=sqlite:////data/sqlite.db
CORS_ORIGINS=https://spongik.od.ua,https://www.spongik.od.ua
ADMIN_EMAIL=admin@spongik.od
ADMIN_PHONE=+380631234567
ADMIN_PASSWORD=secure-password-123
NOVA_POSHTA_API_KEY=your-api-key-here
```

### 3. Генерация SECRET_KEY

Для генерации безопасного SECRET_KEY:

```bash
# Linux/Mac
openssl rand -hex 32

# Или Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 4. Настройка домена

Домен настраивается в файле `Caddyfile` (см. раздел "Настройка HTTPS с Caddy").

Внутренний nginx использует `server_name _;` для работы с любым доменом через Caddy.

### 5. Запуск приложения

```bash
# Собрать и запустить контейнеры
docker-compose up -d --build

# Проверить статус
docker-compose ps

# Просмотреть логи
docker-compose logs -f
```

### 6. Проверка работы

После запуска проверьте:

- Frontend: https://spongik.od.ua (через Caddy с автоматическим HTTPS)
- Backend API: https://spongik.od.ua/api/health (через Caddy)
- API Docs: https://spongik.od.ua/api/docs (через Caddy)
- Admin Panel: https://spongik.od.ua/admin (через Caddy)

## Настройка HTTPS с Caddy (автоматически)

Caddy автоматически получает и обновляет SSL-сертификаты от Let's Encrypt.

### 1. Настройка Caddyfile

В корне проекта уже создан файл `Caddyfile` с настройками для домена `spongik.od.ua`.

Если нужно изменить домен, отредактируйте `Caddyfile`:

```bash
nano Caddyfile
```

Пример для другого домена:
```
yourdomain.com, www.yourdomain.com {
    reverse_proxy frontend:80
}
```

### 2. Настройка DNS

Убедитесь, что DNS записи для вашего домена указывают на IP сервера:

```
A     @           -> ваш-ip-сервера
A     www         -> ваш-ip-сервера
```

### 3. Обновление CORS_ORIGINS в .env

В файле `.env` укажите HTTPS домены:

```env
CORS_ORIGINS=https://spongik.od.ua,https://www.spongik.od.ua
```

### 4. Запуск с Caddy

Caddy уже добавлен в `docker-compose.yml`. Просто запустите:

```bash
docker-compose up -d --build
```

Caddy автоматически:
- Получит SSL-сертификат от Let's Encrypt
- Настроит автоматический редирект с HTTP на HTTPS
- Будет обновлять сертификат автоматически

### 5. Проверка HTTPS

После запуска подождите 1-2 минуты, пока Caddy получит сертификат, затем проверьте:

```bash
# Проверка статуса Caddy
docker-compose logs caddy

# Откройте в браузере
https://spongik.od.ua
```

---

## Настройка HTTPS вручную (альтернатива - не рекомендуется)

### С использованием Certbot и Let's Encrypt

1. Установите Certbot:

```bash
sudo apt-get update
sudo apt-get install certbot
```

2. Остановите Docker контейнеры:

```bash
docker-compose down
```

3. Получите сертификат:

```bash
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

4. Создайте конфигурацию nginx для HTTPS (создайте `frontend/nginx-ssl.conf`):

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # ... остальная конфигурация как в nginx.conf
    
    location /api/ {
        proxy_pass http://backend:8000/api/;
        # ... proxy headers
    }
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

5. Обновите `docker-compose.yml` для монтирования сертификатов:

```yaml
frontend:
  volumes:
    - ./frontend:/usr/share/nginx/html:ro
    - ./frontend/nginx-ssl.conf:/etc/nginx/conf.d/default.conf:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro
```

6. Запустите снова:

```bash
docker-compose up -d
```

## Обновление приложения

```bash
# Остановить контейнеры
docker-compose down

# Обновить код (git pull)
git pull

# Пересобрать и запустить
docker-compose up -d --build
```

## Резервное копирование

### База данных

```bash
# Создать резервную копию
docker-compose exec backend cp /data/sqlite.db /data/sqlite.db.backup

# Или скопировать на хост
docker-compose exec backend cat /data/sqlite.db > backup-$(date +%Y%m%d).db

# Загруженные файлы (если есть)
docker-compose exec backend tar -czf /data/uploads-backup.tar.gz /data/uploads
docker cp $(docker-compose ps -q backend):/data/uploads-backup.tar.gz .
```

### Восстановление

```bash
# Восстановить базу данных
docker-compose exec backend cp /data/sqlite.db.backup /data/sqlite.db
docker-compose restart backend
```

## Мониторинг

### Просмотр логов

```bash
# Все логи
docker-compose logs -f

# Только backend
docker-compose logs -f backend

# Только frontend
docker-compose logs -f frontend

# Последние 100 строк
docker-compose logs --tail=100
```

### Проверка здоровья

```bash
# Проверить статус контейнеров
docker-compose ps

# Проверить healthcheck backend
curl http://localhost:8000/api/health

# Использование ресурсов
docker stats
```

## Устранение неполадок

### Контейнер не запускается

```bash
# Просмотреть логи
docker-compose logs backend

# Проверить переменные окружения
docker-compose exec backend env | grep -E 'SECRET_KEY|DATABASE_URL|ADMIN'
```

### Проблемы с базой данных

```bash
# Проверить права доступа
docker-compose exec backend ls -la /data/

# Пересоздать базу данных (ОСТОРОЖНО: удалит все данные!)
docker-compose down
docker volume rm spongikod_sqlite_data
docker-compose up -d
```

### Проблемы с правами доступа

```bash
# Исправить права на volumes
sudo chown -R 1000:1000 ./data
```

### Очистка

```bash
# Остановить и удалить контейнеры
docker-compose down

# Удалить volumes (ОСТОРОЖНО: удалит данные!)
docker-compose down -v

# Очистить неиспользуемые образы
docker system prune -a
```

## Производительность

### Оптимизация для продакшена

1. **Nginx кеширование** - добавьте в `nginx.conf`:

```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

2. **Ограничение ресурсов** - добавьте в `docker-compose.yml`:

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '1'
        memory: 512M
      reservations:
        cpus: '0.5'
        memory: 256M
```

3. **Gzip сжатие** - добавьте в `nginx.conf`:

```nginx
gzip on;
gzip_vary on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
```

## Безопасность

1. **Всегда используйте HTTPS в продакшене**
2. **Используйте сильный SECRET_KEY**
3. **Регулярно обновляйте зависимости**
4. **Не коммитьте .env файл в Git**
5. **Ограничьте доступ к админ-панели (firewall/nginx)**

## Контакты и поддержка

При возникновении проблем проверьте:
- Логи контейнеров: `docker-compose logs`
- Статус контейнеров: `docker-compose ps`
- Здоровье API: `curl http://localhost:8000/api/health`

