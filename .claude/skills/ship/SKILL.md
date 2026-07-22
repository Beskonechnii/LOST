---
name: ship
description: Закоммитить и запушить изменения репозитория League of Spirit (LOST) на origin. Триггеры — "коммит", "закоммить", "запушь", "залей на гит", "ship". Порядок commit → push.
---

# ship — commit → push (репозиторий LOST)

Один репозиторий на уровне главной папки. Работаем на `dev`, `main` держим стабильной.
Все git-команды — с `-C "D:/DEV/League-of-spirit"` (без `cd`).

## Шаги
1. Застейджить: `git -C "D:/DEV/League-of-spirit" add -A`
2. Что идёт: `git -C "D:/DEV/League-of-spirit" status --short` (+ при желании `diff --cached --stat`). Кратко резюмировать одной строкой.
3. Коммит — сабж по-русски, префикс `feat/fix/chore/docs`, всегда с трейлером:
   ```
   git -C "D:/DEV/League-of-spirit" commit -m "<тип>: <короткий сабж>" -m "<опц. тело>" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
   ```
4. Пуш текущей ветки:
   ```
   git -C "D:/DEV/League-of-spirit" push origin "$(git -C "D:/DEV/League-of-spirit" branch --show-current)"
   ```
5. Отчёт: короткий SHA + число файлов, 1 строкой.

## Правила
- **`main` не пушить без явной просьбы** — по умолчанию `dev`.
- Трейлер co-author обязателен.
- Хуки не пропускать (`--no-verify` — только по просьбе).
- При первом сетевом обращении Git Credential Manager может показать окно входа — его завершает пользователь.
- Не коммитить `node_modules` / `.env` / `dev.db` / `web/src/generated` (уже в `.gitignore`).
- Remote: `origin` → github.com/Beskonechnii/League-of-spirit (приватный).
