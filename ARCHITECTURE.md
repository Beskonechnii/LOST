# Архитектура — операционная система LOST (данные / флоу / треккинг)

Дев-спека того, что реализуем. Ядро — **один источник истины (БД)**: админка пишет, публичная таблица и графика читают.
Решения приняты 22.07.2026. Значения баллов и точные правила — задаём позже.

## Стек (рекомендация)

- **Next.js (React, TypeScript)** — одно приложение: публичная часть (standings) + **админка** (MVP/баллы) + API-роуты (синк OpenDota, запись баллов).
- **SQLite + Prisma (ORM)** — «кастомная БД», файловая, минимум инфраструктуры. Рост → Postgres меняет только строку подключения.
- Почему: один codebase, «меньше кода», не-разработчик правит через админку, фронт читает из той же БД.

### Интеграция с лендингом (Tilda)

Текущий сайт — **Tilda** (закрытый конструктор: кастомную БД внутрь не встроить, но есть HTML-блоки, iframe, кастомный JS). Сейчас таблицу результатов тянет из **Google Sheets**, профили — в Stratz/Dotabuff.

- Наш Next.js — на **субдомене** (напр. `app.leagueofspirits.ru`): `/standings` (публично), `/admin` (защищено), `/api/*` (синк OpenDota, баллы, JSON для графики).
- **Публичная таблица «на лендинге»:** встраиваем в Tilda через HTML-блок — `iframe` на `app…/standings` (быстро) **или** кастомный `fetch()` нашего API с рендером (аккуратнее). Заменяет текущий Google-Sheet-блок.
- **Админка** — только на субдомене, в Tilda не встраиваем.
- **DNS:** CNAME субдомена → хостинг (напр. Vercel). Корень Tilda не трогаем.
- Маркетинговый лендинг оставляем как есть — добавляем пункт меню + блок-встройку.

## Модель данных (Prisma, черновик)

```
Team        { id, name, tag, logo, group }
Player      { id, teamId, nickname, accountId }        // accountId = Dota/Steam32
Match       { id, openDotaMatchId?, teamAId, teamBId, scheduledAt, status, winnerTeamId, radiantTeamId }
MatchStat   { id, matchId, playerId, heroDamage, netWorth, kills, deaths, assists, campsStacked, lastHits }  // кэш OpenDota
PointsEntry { id, subjectType[team|player|caster|streamer], subjectId, reason[placement|mvp|cast|stream|manual], amount, matchId?, createdAt, createdBy }
```

- **Standings** не храним как истину — считаем: wins/losses из `Match`, очки из суммы `PointsEntry`. (Можно кэшировать.)
- **MVP** = запись `PointsEntry(reason=mvp)` + отметка игрока матча.

## SYNC (OpenDota)

1. Вход: `openDotaMatchId` (админ вводит после игры).
2. `GET /matches/{id}` → `players[]`: `hero_damage`, `net_worth`, `kills/deaths/assists`, `camps_stacked`, `last_hits` → пишем в `MatchStat`.
3. Из статы — **авто-подсказка MVP** (топ по композитному скору) + данные для инфографики.

⚠️ Детальные поля (урон, лагеря) есть только у **распарсенных** матчей. Если не распарсен — дёрнуть `POST /request/{id}`, подождать, повторить.

## TRACKING (баллы)

- **Реестр `PointsEntry` — единственный способ менять баллы.** Итог = сумма записей.
- **Корректировки = новые записи** (сторно/добавление), ничего не перетираем → полный аудит.
- Правила (заготовка, числа позже):
  - `placement` — победа матча → очки команде.
  - `mvp` — игрок матча → очки/отметка.
  - `cast` / `stream` — кастеру/стримеру за эфир.

## Админка (замена «бота», на нашем сайте)

- Простой защищённый вход (один админ/пароль на старте).
- Экраны: матчи (результат + `match_id` → синк) · назначить MVP (из подсказки) · начислить баллы (кастер/стример/ручная корректировка) · просмотр реестра.

## Публичная часть (на лендинге)

- Таблица standings, расписание/результаты, страница MVP/лидеров — из БД.
- Те же данные отдаём в **визуальные шаблоны** (анонсы/инфографика) — тестируем на картинках.

## Флоу (итог)

```
матч сыгран → админ вносит match_id → SYNC (OpenDota) → MatchStat
           → подсказка MVP → админ подтверждает MVP + баллы → PointsEntry
           → Standings пересчитан → публичная таблица + данные для визуала
```

## Что реализуем (этапы)

1. ✅ Каркас Next.js + Prisma 7 (libSQL adapter) + SQLite; схема БД (миграция). Проверено `GET /api/health`.
2. ✅ Публичная таблица standings (`/standings` + JSON `/api/standings`) + сид демо-данных (`prisma/seed.ts`, `npx tsx prisma/seed.ts`). CRUD-запись команд/матчей — вместе с админкой (шаг 4–5).
3. ✅ SYNC OpenDota (`src/lib/opendota.ts` + `src/lib/match-sync.ts`, `POST /api/matches/[id]/sync`): по `openDotaMatchId` → `MatchStat` (10 игроков), авто-победитель из `radiant_win`, подсказка MVP по композитному скору. Баллы не начисляет. Демо-привязка: `npx tsx prisma/demo-link.ts`.
4. Реестр баллов: начисление (команды/MVP/кастер/стример) + корректировки.
5. Защита админки.
6. Отдача данных в визуальные шаблоны (тест на картинках).

## Инструмент: импорт матча (каркас)

Стейтлес-просмотр: главная `/` (клиент) → `GET /api/opendota/match/[id]` → `fetchMatchView` (`src/lib/opendota.ts`).
Вставил `match_id` → две таблицы **Свет/Тьма**: игрок · герой · уровень · K/D/A · ценность (net worth) · победа. Имена команд подставляются из OpenDota, но поле **редактируемое** (кастомим под LOST). БД не трогает — всё из источника, ничего не выдумано.

## Заметки по стеку (грабли Prisma 7)

- Проект — в `web/` (Next.js 16, Turbopack). Docs — в корне репозитория.
- **Prisma 7:** клиент требует **driver-adapter** — `new PrismaClient()` без аргумента не компилится. Используем `@prisma/adapter-libsql` (чистый JS, без нативной сборки). Singleton — `web/src/lib/prisma.ts`.
- Генератор `prisma-client` кладёт клиент в `web/src/generated/prisma` (в `.gitignore`, импорт `@/generated/prisma/client`).
- **БД:** `web/prisma/dev.db`; путь — из `DATABASE_URL` (`.env`), резолвится относительно cwd (`web/`) и для CLI, и для рантайма — не абсолютный `file:`-URL (libsql на Windows его ломает).
- Проверка связки: `GET /api/health` → `{ ok, teams, matches, points }`.
- Запуск: `cd web && npm run dev` (порт 3000).
