-- Состав становится отдельной сущностью: роль и капитанство переезжают с игрока на место в составе.
-- Причина — один человек может быть действующим игроком в одной команде и заменой в другой
-- (Chervyak: soft-support в Cruiser Aurora Team и замена в MOLOKO), а `Player.teamId` знал одну команду.

CREATE TABLE "RosterSpot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role" TEXT,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    CONSTRAINT "RosterSpot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RosterSpot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RosterSpot_teamId_playerId_key" ON "RosterSpot"("teamId", "playerId");

-- переносим уже залитые составы, чтобы не терять данные на миграции
INSERT INTO "RosterSpot" ("teamId", "playerId", "role", "isCaptain")
SELECT "teamId", "id", "role", "isCaptain" FROM "Player" WHERE "teamId" IS NOT NULL;

-- sqlite не умеет DROP COLUMN на таблице со связями — пересоздаём Player без role/isCaptain/teamId
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "realName" TEXT,
    "accountId" TEXT,
    "mmr" INTEGER,
    "photo" TEXT,
    "steamUrl" TEXT,
    "dotabuffUrl" TEXT,
    "stratzUrl" TEXT,
    "telegram" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_Player" ("id", "slug", "nickname", "realName", "accountId", "mmr", "photo", "steamUrl", "dotabuffUrl", "stratzUrl", "telegram", "createdAt")
SELECT "id", "slug", "nickname", "realName", "accountId", "mmr", "photo", "steamUrl", "dotabuffUrl", "stratzUrl", "telegram", "createdAt" FROM "Player";

DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");

PRAGMA foreign_keys=ON;
