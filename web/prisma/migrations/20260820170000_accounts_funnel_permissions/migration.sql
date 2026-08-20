-- DropIndex
DROP INDEX "AuthToken_accountId_idx";

-- DropIndex
DROP INDEX "AuthToken_tokenHash_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AuthToken";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "googleSub" TEXT,
    "passwordHash" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'player',
    "permissions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "application" TEXT,
    "policyAcceptedAt" DATETIME,
    "submittedAt" DATETIME,
    "reviewedAt" DATETIME,
    "reviewedById" INTEGER,
    "rejectedReason" TEXT,
    "playerId" INTEGER,
    "claimId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAccount_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserAccount_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_UserAccount" ("avatar", "claimId", "createdAt", "email", "emailVerified", "googleSub", "id", "name", "passwordHash", "playerId", "role") SELECT "avatar", "claimId", "createdAt", "email", "emailVerified", "googleSub", "id", "name", "passwordHash", "playerId", "role" FROM "UserAccount";
DROP TABLE "UserAccount";
ALTER TABLE "new_UserAccount" RENAME TO "UserAccount";
CREATE UNIQUE INDEX "UserAccount_email_key" ON "UserAccount"("email");
CREATE UNIQUE INDEX "UserAccount_googleSub_key" ON "UserAccount"("googleSub");
CREATE UNIQUE INDEX "UserAccount_playerId_key" ON "UserAccount"("playerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Одноразово: аккаунты, заведённые до воронки, уже живые — переводим в active. Дефолт колонки
-- (draft) касается только новых регистраций, иначе действующие люди (включая владельца) оказались
-- бы заперты в воронке, а апрувить их некому.
UPDATE "UserAccount" SET "status" = 'active';
