-- AlterTable
ALTER TABLE "Series" ADD COLUMN "format" TEXT;
ALTER TABLE "Series" ADD COLUMN "startAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Design" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "doc" TEXT NOT NULL,
    "kind" TEXT,
    "seriesId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Design_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Design" ("createdAt", "doc", "id", "title", "updatedAt") SELECT "createdAt", "doc", "id", "title", "updatedAt" FROM "Design";
DROP TABLE "Design";
ALTER TABLE "new_Design" RENAME TO "Design";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
