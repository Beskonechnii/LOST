-- Позиция игрока (число 1–5) заменена ролью-строкой: появились coach и standin,
-- а сами позиции получили названия (см. src/lib/roles.ts).
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "realName" TEXT,
    "accountId" TEXT,
    "photo" TEXT,
    "role" TEXT,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "steamUrl" TEXT,
    "dotabuffUrl" TEXT,
    "stratzUrl" TEXT,
    "telegram" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" INTEGER,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- перенос данных: 1–5 → ключи ролей, пустая позиция → standin (в таблице составов это замены)
INSERT INTO "new_Player" ("accountId", "createdAt", "dotabuffUrl", "id", "isCaptain", "nickname", "photo", "realName", "slug", "steamUrl", "stratzUrl", "teamId", "telegram", "role")
SELECT "accountId", "createdAt", "dotabuffUrl", "id", "isCaptain", "nickname", "photo", "realName", "slug", "steamUrl", "stratzUrl", "teamId", "telegram",
    CASE "position"
        WHEN 1 THEN 'carry'
        WHEN 2 THEN 'mid'
        WHEN 3 THEN 'offlane'
        WHEN 4 THEN 'soft-support'
        WHEN 5 THEN 'hard-support'
        ELSE 'standin'
    END
FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
