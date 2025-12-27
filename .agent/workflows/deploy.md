---
description: Сборка и публикация Docker образа в Docker Hub
---

# Deploy Workflow

## Шаги

1. Убедитесь что все изменения закоммичены:
```bash
git status
git add .
git commit -m "feat: описание изменений"
git push origin main
```

// turbo
2. Соберите Docker образ:
```bash
cd /home/truffle/Загрузки/postgresus
docker build -t putopelatudo/postgresus:latest .
```

3. Запушьте образ в Docker Hub:
```bash
docker push putopelatudo/postgresus:latest
```

4. На VPS обновите контейнер:
```bash
docker pull putopelatudo/postgresus:latest
docker compose down
docker compose up -d
```

## Для стабильной версии

1. Создайте git тег:
```bash
git tag v1.x.x
git push origin v1.x.x
```

2. Соберите версионированный образ:
```bash
docker build -t putopelatudo/postgresus:v1.x.x .
docker push putopelatudo/postgresus:v1.x.x
```
