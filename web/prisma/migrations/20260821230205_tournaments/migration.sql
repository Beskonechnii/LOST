-- CreateTable
CREATE TABLE "Tournament" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short" TEXT,
    "description" TEXT,
    "format" TEXT,
    "prize" TEXT,
    "logo" TEXT,
    "banner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startAt" DATETIME,
    "endAt" DATETIME,
    "regOpenAt" DATETIME,
    "regCloseAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Division" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "short" TEXT,
    "orderNo" INTEGER NOT NULL DEFAULT 0,
    "mmrFrom" INTEGER,
    "mmrTo" INTEGER,
    "tournamentId" INTEGER NOT NULL,
    CONSTRAINT "Division_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "seed" INTEGER,
    "group" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "divisionId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    CONSTRAINT "TournamentEntry_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TournamentEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamApplication" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "source" TEXT NOT NULL DEFAULT 'import',
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedById" INTEGER,
    "tournamentId" INTEGER NOT NULL,
    "divisionId" INTEGER,
    "teamId" INTEGER,
    CONSTRAINT "TeamApplication_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamApplication_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamApplication_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GroupEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "division" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "place" INTEGER NOT NULL,
    "played" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "divisionId" INTEGER,
    CONSTRAINT "GroupEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupEntry_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GroupEntry" ("division", "group", "id", "losses", "place", "played", "points", "teamId", "wins") SELECT "division", "group", "id", "losses", "place", "played", "points", "teamId", "wins" FROM "GroupEntry";
DROP TABLE "GroupEntry";
ALTER TABLE "new_GroupEntry" RENAME TO "GroupEntry";
CREATE UNIQUE INDEX "GroupEntry_division_group_teamId_key" ON "GroupEntry"("division", "group", "teamId");
CREATE TABLE "new_Series" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'group',
    "group" TEXT,
    "bracket" TEXT,
    "round" TEXT,
    "slot" TEXT,
    "playedAt" DATETIME,
    "startAt" DATETIME,
    "format" TEXT,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "guessed" BOOLEAN NOT NULL DEFAULT true,
    "divisionId" INTEGER,
    "homeId" INTEGER NOT NULL,
    "awayId" INTEGER NOT NULL,
    CONSTRAINT "Series_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Series_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Series_awayId_fkey" FOREIGN KEY ("awayId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Series" ("awayId", "awayScore", "bracket", "division", "format", "group", "guessed", "homeId", "homeScore", "id", "playedAt", "round", "slot", "slug", "stage", "startAt") SELECT "awayId", "awayScore", "bracket", "division", "format", "group", "guessed", "homeId", "homeScore", "id", "playedAt", "round", "slot", "slug", "stage", "startAt" FROM "Series";
DROP TABLE "Series";
ALTER TABLE "new_Series" RENAME TO "Series";
CREATE UNIQUE INDEX "Series_slug_key" ON "Series"("slug");
CREATE UNIQUE INDEX "Series_division_stage_group_homeId_awayId_key" ON "Series"("division", "stage", "group", "homeId", "awayId");
CREATE UNIQUE INDEX "Series_division_slot_key" ON "Series"("division", "slot");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_slug_key" ON "Tournament"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Division_tournamentId_slug_key" ON "Division"("tournamentId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Division_tournamentId_name_key" ON "Division"("tournamentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentEntry_divisionId_teamId_key" ON "TournamentEntry"("divisionId", "teamId");
