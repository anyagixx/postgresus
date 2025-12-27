# Postgresus - Project Rules

## О проекте
**Postgresus** - это self-hosted решение для автоматического резервного копирования баз данных.
- **Оригинал**: [databasus/databasus](https://github.com/databasus/databasus)
- **Наш форк**: [anyagixx/postgresus](https://github.com/anyagixx/postgresus)
- **Docker Hub**: [putopelatudo/postgresus](https://hub.docker.com/repository/docker/putopelatudo/postgresus)

## Архитектура

### Backend (Go 1.24)
- **Фреймворк**: Gin
- **ORM**: GORM
- **БД приложения**: PostgreSQL 17 (встроенный)
- **Миграции**: Goose
- **Шифрование**: AES-256-GCM
- **Расположение**: `backend/`

### Frontend (React 19)
- **UI**: Ant Design
- **Стили**: TailwindCSS 4
- **Роутинг**: React Router 7
- **Сборка**: Vite
- **Расположение**: `frontend/`

### Поддерживаемые БД для бэкапа
| Тип | Версии |
|-----|--------|
| PostgreSQL | 12, 13, 14, 15, 16, 17, 18 |
| MySQL | 5.7, 8.0, 8.4, 9.0 |
| MariaDB | 10.6, 12.1 |
| MongoDB | 4, 5, 6, 7, 8 |

### Хранилища (8 типов)
- Local Storage, S3, Google Drive, NAS
- Azure Blob, FTP, SFTP, Rclone

### Нотификаторы (6 типов)
- Email, Telegram, Slack, Discord, Webhook, MS Teams

## Структура кода

```
backend/
├── cmd/main.go              # Точка входа
├── migrations/              # SQL миграции (Goose)
├── internal/
│   ├── config/              # Конфигурация
│   ├── storage/             # Подключение к БД
│   └── features/            # Модули (feature-based)
│       ├── databases/       # Управление БД для бэкапа
│       ├── servers/         # Группировка по серверам
│       ├── storages/        # Хранилища бэкапов
│       ├── backups/         # Логика резервного копирования
│       ├── restores/        # Восстановление из бэкапов
│       ├── notifiers/       # Уведомления
│       ├── users/           # Пользователи и аутентификация
│       └── workspaces/      # Мультитенантность

frontend/
├── src/
│   ├── App.tsx              # Точка входа
│   ├── entity/              # API клиенты и типы
│   └── features/            # UI компоненты по модулям
```

## Паттерны кода

### Backend Feature Structure
Каждый feature следует паттерну:
```
feature/
├── controller.go   # HTTP хендлеры (Gin)
├── service.go      # Бизнес-логика
├── repository.go   # Работа с БД (GORM)
├── model.go        # Модели данных
└── di.go           # Dependency Injection
```

### Шифрование чувствительных данных
- Пароли БД шифруются через `FieldEncryptor`
- Master key хранится в `/postgresus-data/secret.key`
- Бэкапы могут шифроваться AES-256-GCM

---

## Правила разработки

### 1. Git Workflow
```bash
# После каждого значимого изменения
git add .
git commit -m "feat: описание изменения"
git push origin main
```

### 2. Docker Build & Push
```bash
# Сборка и публикация
docker build -t putopelatudo/postgresus:latest .
docker push putopelatudo/postgresus:latest

# С версией (для стабильных релизов)
docker build -t putopelatudo/postgresus:v1.0.0 .
docker push putopelatudo/postgresus:v1.0.0
```

### 3. Тестирование
> **ВАЖНО**: Все тесты проводятся на VPS сервере пользователя, НЕ на локальном ПК разработки.
> AI-ассистент даёт готовые команды, пользователь выполняет их на VPS и возвращает результат.

Процесс:
1. Запушить образ в Docker Hub
2. На VPS: `docker pull putopelatudo/postgresus:latest`
3. На VPS: `docker compose up -d`
4. Протестировать функционал
5. Вернуть логи или результат AI-ассистенту

### 4. Стабильные версии
Когда разработка стабильна:
1. Создать тег версии: `git tag v1.x.x`
2. Запушить тег: `git push origin v1.x.x`
3. Собрать образ с версией: `docker build -t putopelatudo/postgresus:v1.x.x .`
4. Запушить версионированный образ

### 5. Миграции БД
- Миграции в `backend/migrations/`
- Формат: `YYYYMMDDHHMMSS_description.sql`
- Применяются автоматически при старте через `goose up`

---

## Ключевые файлы для изменений

| Задача | Файлы |
|--------|-------|
| Новая модель данных | `backend/internal/features/<name>/model.go` |
| API эндпоинт | `backend/internal/features/<name>/controller.go` |
| Миграция БД | `backend/migrations/YYYYMMDDHHMMSS_*.sql` |
| UI компонент | `frontend/src/features/<name>/ui/` |
| API клиент | `frontend/src/entity/<name>/api/` |
| Docker | `Dockerfile`, `docker-compose.yml` |

---

## Команды

### Локальная разработка (не используется для тестов)
```bash
# Backend
cd backend && go run cmd/main.go

# Frontend  
cd frontend && npm run dev
```

### Docker
```bash
# Сборка
docker build -t putopelatudo/postgresus:latest .

# Запуск локально
docker compose up -d

# Логи
docker logs postgresus -f

# Остановка
docker compose down
```
