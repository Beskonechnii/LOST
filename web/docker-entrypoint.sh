#!/bin/sh
set -e

# Старт контейнера LOST: подготовить тома и докатить миграции, потом отдать управление серверу.

mkdir -p /app/data /app/public/uploads

# Первый запуск: кладём базу лиги из репозитория. Дальше она живёт своей жизнью на томе —
# сетку встреч и правки результатов вводят руками, восстановить их скриптами нечем.
if [ ! -f /app/data/dev.db ] && [ -f /app/prisma/dev.db ]; then
  echo "→ первый запуск: копирую базу из образа в том"
  cp /app/prisma/dev.db /app/data/dev.db
fi

# Лого и фото ростера из репозитория — только те, которых на томе ещё нет (-n не перетирает).
cp -rn /app/.seed-uploads/. /app/public/uploads/ 2>/dev/null || true

echo "→ миграции"
npx prisma migrate deploy

exec "$@"
