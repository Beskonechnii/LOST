-- CreateTable
CREATE TABLE "GroupEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "division" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "place" INTEGER NOT NULL,
    "played" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    CONSTRAINT "GroupEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroupSeries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "division" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "guessed" BOOLEAN NOT NULL DEFAULT true,
    "homeId" INTEGER NOT NULL,
    "awayId" INTEGER NOT NULL,
    CONSTRAINT "GroupSeries_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupSeries_awayId_fkey" FOREIGN KEY ("awayId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupEntry_division_group_teamId_key" ON "GroupEntry"("division", "group", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSeries_division_group_homeId_awayId_key" ON "GroupSeries"("division", "group", "homeId", "awayId");
