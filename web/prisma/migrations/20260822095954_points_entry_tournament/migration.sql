-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PointsEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subjectType" TEXT NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchId" INTEGER,
    "tournamentId" INTEGER,
    CONSTRAINT "PointsEntry_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PointsEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PointsEntry" ("amount", "createdAt", "createdBy", "id", "matchId", "note", "reason", "subjectId", "subjectType") SELECT "amount", "createdAt", "createdBy", "id", "matchId", "note", "reason", "subjectId", "subjectType" FROM "PointsEntry";
DROP TABLE "PointsEntry";
ALTER TABLE "new_PointsEntry" RENAME TO "PointsEntry";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
