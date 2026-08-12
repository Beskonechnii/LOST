-- CreateTable
CREATE TABLE "UserAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "playerId" INTEGER,
    "claimId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAccount_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserAccount_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_email_key" ON "UserAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_googleSub_key" ON "UserAccount"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_playerId_key" ON "UserAccount"("playerId");
