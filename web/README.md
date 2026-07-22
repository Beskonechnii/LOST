# LOST — приложение

Операционная система лиги [League of Spirit](https://leagueofspirits.ru): отчёты по матчам из OpenDota,
таблица лиги, справочник команд и игроков, генерация графики к матчам.

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 · Prisma 7 + SQLite (libsql-адаптер).

## Запуск

```bash
npm install
npm run dev
```

Откроется на http://localhost:3000. Проверка связки с БД: `GET /api/health`.

`.env` (в `.gitignore`, в репозиторий не попадает):

| Переменная | Зачем |
|---|---|
| `DATABASE_URL` | путь к SQLite, **относительный** к `web/` — абсолютный `file:`-URL ломает libsql на Windows |
| `OPENAI_API_KEY` | генерация картинок в `/studio/generate`; без неё остальное приложение работает |

Проверки: `npx tsc --noEmit` и `npm run lint`. Тестов в проекте нет.

## Где что

- **[../CLAUDE.md](../CLAUDE.md)** — карта проекта: где что лежит и кто за что отвечает. Начинать отсюда.
- **[../ARCHITECTURE.md](../ARCHITECTURE.md)** — принятые решения, модель данных, флоу, статус этапов.
- **[AGENTS.md](./AGENTS.md)** — правила работы внутри этой папки (Next 16, Prisma 7).
