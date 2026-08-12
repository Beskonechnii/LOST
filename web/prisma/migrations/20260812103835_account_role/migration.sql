-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'player',
    "playerId" INTEGER,
    "claimId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAccount_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserAccount_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_UserAccount" ("avatar", "claimId", "createdAt", "email", "googleSub", "id", "name", "playerId") SELECT "avatar", "claimId", "createdAt", "email", "googleSub", "id", "name", "playerId" FROM "UserAccount";
DROP TABLE "UserAccount";
ALTER TABLE "new_UserAccount" RENAME TO "UserAccount";
CREATE UNIQUE INDEX "UserAccount_email_key" ON "UserAccount"("email");
CREATE UNIQUE INDEX "UserAccount_googleSub_key" ON "UserAccount"("googleSub");
CREATE UNIQUE INDEX "UserAccount_playerId_key" ON "UserAccount"("playerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
