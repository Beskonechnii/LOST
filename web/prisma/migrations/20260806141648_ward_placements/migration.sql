-- CreateTable
CREATE TABLE "Ward" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matchId" INTEGER NOT NULL,
    "teamId" INTEGER,
    "side" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "heroSlug" TEXT NOT NULL DEFAULT '',
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "placed" INTEGER NOT NULL,
    "leftAt" INTEGER,
    "killerSlug" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Ward_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ward_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Ward_teamId_idx" ON "Ward"("teamId");

-- CreateIndex
CREATE INDEX "Ward_matchId_idx" ON "Ward"("matchId");
