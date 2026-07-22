/*
  Warnings:

  - Added the required column `slug` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Render" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "templateId" TEXT NOT NULL,
    "title" TEXT,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchId" INTEGER,
    CONSTRAINT "Render_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
    "position" INTEGER,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "steamUrl" TEXT,
    "dotabuffUrl" TEXT,
    "stratzUrl" TEXT,
    "telegram" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" INTEGER,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- slug для уже существующих (демо) строк: временный уникальный ключ из id.
-- Реальные слаги приезжают импортом составов (scripts/import-roster.ts).
INSERT INTO "new_Player" ("accountId", "createdAt", "id", "nickname", "teamId", "slug") SELECT "accountId", "createdAt", "id", "nickname", "teamId", 'player-' || "id" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");
CREATE TABLE "new_Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT,
    "logo" TEXT,
    "wordmark" TEXT,
    "photo" TEXT,
    "color" TEXT,
    "group" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Team" ("createdAt", "group", "id", "logo", "name", "tag", "slug") SELECT "createdAt", "group", "id", "logo", "name", "tag", 'team-' || "id" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
