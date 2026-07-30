-- Половину сетки у уже заведённых серий плей-офф проставляем из раунда: колонка появилась позже,
-- чем первые встречи, а без неё они не попадают ни в один фильтр «верхняя / нижняя».
-- Соответствие раунд → сетка держится в src/lib/stages.ts (PLAYOFF_ROUNDS) — правится там же.
UPDATE "Series" SET "bracket" = 'upper'
 WHERE "stage" = 'playoff' AND "bracket" IS NULL
   AND "round" IN ('Четвертьфинал', 'Полуфинал', 'Финал верхней');

UPDATE "Series" SET "bracket" = 'lower'
 WHERE "stage" = 'playoff' AND "bracket" IS NULL
   AND "round" IN ('Нижняя R1', 'Нижняя R2', 'Финал нижней');

UPDATE "Series" SET "bracket" = 'grand'
 WHERE "stage" = 'playoff' AND "bracket" IS NULL AND "round" = 'Гранд-финал';
