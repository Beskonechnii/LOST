-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "realName" TEXT,
    "accountId" TEXT,
    "mmr" INTEGER,
    "tp" INTEGER NOT NULL DEFAULT 0,
    "photo" TEXT,
    "steamUrl" TEXT,
    "dotabuffUrl" TEXT,
    "stratzUrl" TEXT,
    "telegram" TEXT,
    "birthday" DATETIME,
    "city" TEXT,
    "country" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Player" ("accountId", "birthday", "city", "country", "createdAt", "dotabuffUrl", "id", "mmr", "nickname", "photo", "realName", "slug", "steamUrl", "stratzUrl", "telegram") SELECT "accountId", "birthday", "city", "country", "createdAt", "dotabuffUrl", "id", "mmr", "nickname", "photo", "realName", "slug", "steamUrl", "stratzUrl", "telegram" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
