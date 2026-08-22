-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RosterSpot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role" TEXT,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "divisionId" INTEGER,
    CONSTRAINT "RosterSpot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RosterSpot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RosterSpot_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RosterSpot" ("createdAt", "id", "isCaptain", "playerId", "role", "teamId") SELECT "createdAt", "id", "isCaptain", "playerId", "role", "teamId" FROM "RosterSpot";
DROP TABLE "RosterSpot";
ALTER TABLE "new_RosterSpot" RENAME TO "RosterSpot";
CREATE UNIQUE INDEX "RosterSpot_teamId_playerId_divisionId_key" ON "RosterSpot"("teamId", "playerId", "divisionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
