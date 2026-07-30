-- Архив по сериям: GroupSeries → Series (плюс плей-офф), карты серии на Match, стата игрока шире.
-- Переименование, а не drop+create: в GroupSeries лежит вручную выверенная сетка группы.

-- GroupSeries → Series
ALTER TABLE "GroupSeries" RENAME TO "Series";
ALTER TABLE "Series" ADD COLUMN "stage" TEXT NOT NULL DEFAULT 'group';
ALTER TABLE "Series" ADD COLUMN "round" TEXT;
ALTER TABLE "Series" ADD COLUMN "playedAt" DATETIME;

-- «group» становится необязательной (у плей-офф её нет) — в sqlite это пересоздание таблицы.
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Series" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "division" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'group',
    "group" TEXT,
    "round" TEXT,
    "playedAt" DATETIME,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "guessed" BOOLEAN NOT NULL DEFAULT true,
    "homeId" INTEGER NOT NULL,
    "awayId" INTEGER NOT NULL,
    CONSTRAINT "Series_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Series_awayId_fkey" FOREIGN KEY ("awayId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Series" ("id", "division", "stage", "group", "round", "playedAt", "homeScore", "awayScore", "guessed", "homeId", "awayId")
SELECT "id", "division", "stage", "group", "round", "playedAt", "homeScore", "awayScore", "guessed", "homeId", "awayId" FROM "Series";
DROP TABLE "Series";
ALTER TABLE "new_Series" RENAME TO "Series";
DROP INDEX IF EXISTS "GroupSeries_division_group_homeId_awayId_key";
CREATE UNIQUE INDEX "Series_division_stage_group_homeId_awayId_key" ON "Series"("division", "stage", "group", "homeId", "awayId");

-- Карты серии + свойства карты, нужные для нормировки рейтингов.
ALTER TABLE "Match" ADD COLUMN "seriesId" INTEGER REFERENCES "Series" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Match" ADD COLUMN "gameNumber" INTEGER;
ALTER TABLE "Match" ADD COLUMN "startedAt" DATETIME;
ALTER TABLE "Match" ADD COLUMN "durationSec" INTEGER;
CREATE UNIQUE INDEX "Match_seriesId_gameNumber_key" ON "Match"("seriesId", "gameNumber");

-- Стата игрока: герой, победа и остальное, по чему строятся рейтинги.
-- Пересоздаём целиком: заодно вешаем каскад от матча (отвязали карту — стата уходит с ней).
CREATE TABLE "new_MatchStat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matchId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "heroSlug" TEXT NOT NULL DEFAULT '',
    "won" BOOLEAN NOT NULL DEFAULT false,
    "heroDamage" INTEGER NOT NULL DEFAULT 0,
    "heroHealing" INTEGER NOT NULL DEFAULT 0,
    "towerDamage" INTEGER NOT NULL DEFAULT 0,
    "netWorth" INTEGER NOT NULL DEFAULT 0,
    "gpm" INTEGER NOT NULL DEFAULT 0,
    "xpm" INTEGER NOT NULL DEFAULT 0,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "deaths" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "campsStacked" INTEGER NOT NULL DEFAULT 0,
    "obsPlaced" INTEGER NOT NULL DEFAULT 0,
    "senPlaced" INTEGER NOT NULL DEFAULT 0,
    "lastHits" INTEGER NOT NULL DEFAULT 0,
    "denies" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MatchStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MatchStat" ("id", "matchId", "playerId", "heroDamage", "netWorth", "kills", "deaths", "assists", "campsStacked", "lastHits")
SELECT "id", "matchId", "playerId", "heroDamage", "netWorth", "kills", "deaths", "assists", "campsStacked", "lastHits" FROM "MatchStat";
DROP TABLE "MatchStat";
ALTER TABLE "new_MatchStat" RENAME TO "MatchStat";
CREATE UNIQUE INDEX "MatchStat_matchId_playerId_key" ON "MatchStat"("matchId", "playerId");
PRAGMA foreign_keys=ON;
