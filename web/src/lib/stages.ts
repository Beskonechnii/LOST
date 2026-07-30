// Стадии турнира — справочник в духе divisions.ts: одно значение связывает поле `Series.stage`,
// фильтр в URL (?stage=group) и подпись в интерфейсе. Без БД, поэтому годится и на клиенте.

export type Stage = "group" | "playoff";
export type Bracket = "upper" | "lower" | "grand";

export type StageDef = { key: Stage; label: string; hint: string };

/** Порядок массива = порядок фильтров в интерфейсе. */
export const STAGES: StageDef[] = [
  { key: "group", label: "Группа", hint: "Групповая стадия дивизиона" },
  { key: "playoff", label: "Плей-офф", hint: "Сетка на выбывание" },
];

export const isStage = (v: string | null | undefined): v is Stage => STAGES.some((s) => s.key === v);

/** Подпись стадии; неизвестное значение отдаём как есть, а не прячем — это видно оператору. */
export const stageLabel = (key: string) => STAGES.find((s) => s.key === key)?.label ?? key;

/**
 * Половины сетки плей-офф. Отдельным полем `Series.bracket`, а не выведенные из названия раунда:
 * по нему фильтруют архив и статистику, а разбирать для этого свободный текст — способ однажды
 * потерять серию из-за опечатки.
 */
export const BRACKETS: { key: Bracket; label: string; short: string }[] = [
  { key: "upper", label: "Верхняя сетка", short: "Верхняя" },
  { key: "lower", label: "Нижняя сетка", short: "Нижняя" },
  { key: "grand", label: "Гранд-финал", short: "Гранд" },
];

export const isBracket = (v: string | null | undefined): v is Bracket => BRACKETS.some((b) => b.key === v);

export const bracketLabel = (key: string | null) => (key ? BRACKETS.find((b) => b.key === key)?.label ?? key : "");

/**
 * Подпись встречи плей-офф: «Верхняя сетка · Полуфинал». У гранд-финала сетка и раунд — одно и то же
 * слово, поэтому дубль схлопываем: «Гранд-финал · Гранд-финал» читается как ошибка вёрстки.
 */
export const playoffLabel = (bracket: string | null, round: string | null) =>
  [...new Set([bracketLabel(bracket), round ?? ""].filter(Boolean))].join(" · ");

/**
 * Раунды плей-офф. В БД свободный текст: регламент ещё не зафиксирован (см. страницу плей-офф
 * дивизиона). Набор подсказок держим здесь, чтобы в архиве не разъехались «ЧФ», «1/4» и
 * «Четвертьфинал» — три записи одного и того же раунда развалят любой разрез.
 * Каждый раунд знает свою половину сетки: выбрал раунд в форме — `bracket` проставился сам.
 */
export const PLAYOFF_ROUNDS: { label: string; bracket: Bracket }[] = [
  { label: "Четвертьфинал", bracket: "upper" },
  { label: "Полуфинал", bracket: "upper" },
  { label: "Финал верхней", bracket: "upper" },
  { label: "Нижняя R1", bracket: "lower" },
  { label: "Нижняя R2", bracket: "lower" },
  { label: "Финал нижней", bracket: "lower" },
  { label: "Гранд-финал", bracket: "grand" },
];

export const bracketOfRound = (round: string): Bracket =>
  PLAYOFF_ROUNDS.find((r) => r.label === round)?.bracket ?? "upper";

/**
 * Разрезы турнира одним списком — то, чем режут и архив, и статистику: группы и половины сетки
 * лежат в разных полях, но для человека это один вопрос «какую часть турнира смотрим».
 */
export type Cut = { key: string; label: string; stage: Stage; group?: string; bracket?: Bracket };

export const CUTS: Cut[] = [
  { key: "group-a", label: "Группа A", stage: "group", group: "A" },
  { key: "group-b", label: "Группа B", stage: "group", group: "B" },
  ...BRACKETS.map((b) => ({ key: b.key, label: b.label, stage: "playoff" as const, bracket: b.key })),
];

export const cutByKey = (key: string | null | undefined) => CUTS.find((c) => c.key === key) ?? null;
