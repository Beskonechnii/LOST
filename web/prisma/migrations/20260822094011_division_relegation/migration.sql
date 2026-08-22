-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Division" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "short" TEXT,
    "orderNo" INTEGER NOT NULL DEFAULT 0,
    "mmrFrom" INTEGER,
    "mmrTo" INTEGER,
    "relegation" BOOLEAN NOT NULL DEFAULT true,
    "tournamentId" INTEGER NOT NULL,
    CONSTRAINT "Division_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Division" ("id", "label", "mmrFrom", "mmrTo", "name", "orderNo", "short", "slug", "tournamentId") SELECT "id", "label", "mmrFrom", "mmrTo", "name", "orderNo", "short", "slug", "tournamentId" FROM "Division";
DROP TABLE "Division";
ALTER TABLE "new_Division" RENAME TO "Division";
CREATE UNIQUE INDEX "Division_tournamentId_slug_key" ON "Division"("tournamentId", "slug");
CREATE UNIQUE INDEX "Division_tournamentId_name_key" ON "Division"("tournamentId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
