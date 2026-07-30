-- Стабильный ключ встречи для адреса. `id` автоинкрементный и после db:import другой,
-- поэтому ссылка вида /series/12 живёт только до первого переноса данных.

ALTER TABLE "Series" ADD COLUMN "slug" TEXT;

-- Основа — слаги команд: они сквозной ключ проекта (импорт, ассеты, снимок).
UPDATE "Series" SET "slug" = (
  SELECT h."slug" || '-vs-' || a."slug"
    FROM "Team" h, "Team" a
   WHERE h."id" = "Series"."homeId" AND a."id" = "Series"."awayId"
);

-- Одна и та же пара может встретиться дважды (группа и плей-офф, верхняя сетка и гранд-финал).
-- Второй и следующим дописываем id: он в пределах одной базы уникален, а слаг после этого
-- уезжает в снимок и на других машинах уже не пересчитывается.
UPDATE "Series" SET "slug" = "slug" || '-' || "id"
 WHERE "id" NOT IN (SELECT MIN("id") FROM "Series" GROUP BY "slug");

-- Колонка объявлена NOT NULL, а ALTER TABLE ADD COLUMN в sqlite так не умеет — пересобираем
-- таблицу целиком (обычный для sqlite приём, тот же, что и при смене nullability выше по истории).
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Series" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'group',
    "group" TEXT,
    "bracket" TEXT,
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
INSERT INTO "new_Series" ("id", "slug", "division", "stage", "group", "bracket", "round", "playedAt", "homeScore", "awayScore", "guessed", "homeId", "awayId")
SELECT "id", "slug", "division", "stage", "group", "bracket", "round", "playedAt", "homeScore", "awayScore", "guessed", "homeId", "awayId" FROM "Series";
DROP TABLE "Series";
ALTER TABLE "new_Series" RENAME TO "Series";
CREATE UNIQUE INDEX "Series_slug_key" ON "Series"("slug");
CREATE UNIQUE INDEX "Series_division_stage_group_homeId_awayId_key" ON "Series"("division", "stage", "group", "homeId", "awayId");
PRAGMA foreign_keys=ON;
