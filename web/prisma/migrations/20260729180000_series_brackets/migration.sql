-- Половины сетки плей-офф (фильтр архива и статистики), счёт карты и уровень игрока —
-- всё, чего не хватало странице серии в духе Dotabuff.

ALTER TABLE "Series" ADD COLUMN "bracket" TEXT;

ALTER TABLE "Match" ADD COLUMN "radiantScore" INTEGER;
ALTER TABLE "Match" ADD COLUMN "direScore" INTEGER;
ALTER TABLE "Match" ADD COLUMN "firstPickRadiant" BOOLEAN;

ALTER TABLE "MatchStat" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 0;
