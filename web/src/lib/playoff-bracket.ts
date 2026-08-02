// Шаблон сетки плей-офф — чистые данные в духе divisions.ts/stages.ts: одно описание связывает
// поле `Series.slot`, позицию в сетке на странице /standings/<div>/playoff и пункт в форме архива.
// Без БД, поэтому годится и на клиенте (форма архива читает шаблон, чтобы показать список слотов).
//
// Регламент лиги (Liquipedia, «Bracket/8U8L2DSL1D»): двойное выбывание из 12 команд —
// 8 в верхней сетке (1–4 места каждой группы), 4 в нижней (5–6 места). Проигравшие верхней
// падают в нижнюю по фиксированным правилам, проигравшие нижней вылетают. Гранд-финал — Bo5,
// остальные встречи — Bo3. Структура одна на оба дивизиона: разнятся только команды-сиды.

import type { Bracket } from "@/lib/stages";

/**
 * Откуда берётся участник слота. Либо посев из группы (место в группе A/B), либо исход другого
 * слота — победитель уходит дальше по своей сетке, проигравший падает вниз или вылетает.
 */
export type SlotSource =
  | { kind: "seed"; group: string; place: number }
  | { kind: "winner"; slot: string }
  | { kind: "loser"; slot: string };

export type BracketSlot = {
  /** Стабильный ключ — он же `Series.slot`. Не менять: по нему привязаны заведённые серии. */
  key: string;
  bracket: Bracket;
  /** Колонка сетки: слоты одного раунда рисуются в один столбец. */
  round: string;
  /** Короткая подпись слота для выпадающего списка формы («ЧФ-1», «Финал нижней»). */
  label: string;
  a: SlotSource;
  b: SlotSource;
  /** Куда падает проигравший: ключ слота нижней сетки, либо null — вылет из турнира. */
  loserTo: string | null;
  /** Максимум карт: Bo3 везде, кроме гранд-финала (Bo5). */
  bestOf: 3 | 5;
};

const seed = (group: string, place: number): SlotSource => ({ kind: "seed", group, place });
const winner = (slot: string): SlotSource => ({ kind: "winner", slot });
const loser = (slot: string): SlotSource => ({ kind: "loser", slot });

/**
 * Слоты сетки, сверху вниз по ходу турнира. Порядок в массиве = порядок разбора и вывода.
 * Посев ЧФ верхней — крест-накрест между группами (A1×B4, B2×A3, A2×B3, B1×A4), чтобы команды
 * из одной группы не встретились в первом раунде. LB-сиды (5–6 места) добираются в нижнюю R1.
 */
export const PLAYOFF_SLOTS: BracketSlot[] = [
  // ── Верхняя сетка ──────────────────────────────────────────────────────────
  { key: "ub-qf1", bracket: "upper", round: "Четвертьфинал", label: "ЧФ-1", a: seed("A", 1), b: seed("B", 4), loserTo: "lb-r1-1", bestOf: 3 },
  { key: "ub-qf2", bracket: "upper", round: "Четвертьфинал", label: "ЧФ-2", a: seed("B", 2), b: seed("A", 3), loserTo: "lb-r1-2", bestOf: 3 },
  { key: "ub-qf3", bracket: "upper", round: "Четвертьфинал", label: "ЧФ-3", a: seed("A", 2), b: seed("B", 3), loserTo: "lb-r1-3", bestOf: 3 },
  { key: "ub-qf4", bracket: "upper", round: "Четвертьфинал", label: "ЧФ-4", a: seed("B", 1), b: seed("A", 4), loserTo: "lb-r1-4", bestOf: 3 },

  { key: "ub-sf1", bracket: "upper", round: "Полуфинал", label: "ПФ-1", a: winner("ub-qf1"), b: winner("ub-qf2"), loserTo: "lb-qf2", bestOf: 3 },
  { key: "ub-sf2", bracket: "upper", round: "Полуфинал", label: "ПФ-2", a: winner("ub-qf3"), b: winner("ub-qf4"), loserTo: "lb-qf1", bestOf: 3 },

  { key: "ub-f", bracket: "upper", round: "Финал верхней", label: "Финал верхней", a: winner("ub-sf1"), b: winner("ub-sf2"), loserTo: "lb-f", bestOf: 3 },

  // ── Нижняя сетка ───────────────────────────────────────────────────────────
  // R1: проигравший ЧФ верхней против сида 5–6. Проигравший здесь — уже вылет.
  { key: "lb-r1-1", bracket: "lower", round: "Нижняя R1", label: "Нижняя R1-1", a: loser("ub-qf1"), b: seed("A", 6), loserTo: null, bestOf: 3 },
  { key: "lb-r1-2", bracket: "lower", round: "Нижняя R1", label: "Нижняя R1-2", a: loser("ub-qf2"), b: seed("B", 5), loserTo: null, bestOf: 3 },
  { key: "lb-r1-3", bracket: "lower", round: "Нижняя R1", label: "Нижняя R1-3", a: loser("ub-qf3"), b: seed("A", 5), loserTo: null, bestOf: 3 },
  { key: "lb-r1-4", bracket: "lower", round: "Нижняя R1", label: "Нижняя R1-4", a: loser("ub-qf4"), b: seed("B", 6), loserTo: null, bestOf: 3 },

  // R2: победители R1 попарно. Тоже на вылет.
  { key: "lb-r2-1", bracket: "lower", round: "Нижняя R2", label: "Нижняя R2-1", a: winner("lb-r1-1"), b: winner("lb-r1-2"), loserTo: null, bestOf: 3 },
  { key: "lb-r2-2", bracket: "lower", round: "Нижняя R2", label: "Нижняя R2-2", a: winner("lb-r1-3"), b: winner("lb-r1-4"), loserTo: null, bestOf: 3 },

  // ЧФ нижней: сюда падают проигравшие полуфиналов верхней (крест-накрест, чтобы избежать рематча).
  { key: "lb-qf1", bracket: "lower", round: "Нижняя ЧФ", label: "Нижняя ЧФ-1", a: loser("ub-sf2"), b: winner("lb-r2-1"), loserTo: null, bestOf: 3 },
  { key: "lb-qf2", bracket: "lower", round: "Нижняя ЧФ", label: "Нижняя ЧФ-2", a: winner("lb-r2-2"), b: loser("ub-sf1"), loserTo: null, bestOf: 3 },

  { key: "lb-sf", bracket: "lower", round: "Нижняя ПФ", label: "Нижняя ПФ", a: winner("lb-qf1"), b: winner("lb-qf2"), loserTo: null, bestOf: 3 },

  // Финал нижней: победитель нижней против проигравшего финала верхней.
  { key: "lb-f", bracket: "lower", round: "Финал нижней", label: "Финал нижней", a: loser("ub-f"), b: winner("lb-sf"), loserTo: null, bestOf: 3 },

  // ── Гранд-финал ────────────────────────────────────────────────────────────
  { key: "gf", bracket: "grand", round: "Гранд-финал", label: "Гранд-финал", a: winner("ub-f"), b: winner("lb-f"), loserTo: null, bestOf: 5 },
];

export const slotByKey = (key: string | null | undefined) => PLAYOFF_SLOTS.find((s) => s.key === key) ?? null;

export const isPlayoffSlot = (key: string | null | undefined): boolean => PLAYOFF_SLOTS.some((s) => s.key === key);

/** Колонки сетки в порядке вывода: раунды каждой половины, слоты внутри — по массиву. */
export const PLAYOFF_ROUND_COLUMNS: { bracket: Bracket; round: string }[] = PLAYOFF_SLOTS.reduce<
  { bracket: Bracket; round: string }[]
>((cols, s) => {
  if (!cols.some((c) => c.bracket === s.bracket && c.round === s.round)) cols.push({ bracket: s.bracket, round: s.round });
  return cols;
}, []);

/** Допустимые счета серии по Bo: победитель берёт большинство карт. Пусто → неизвестный Bo. */
export function validScores(bestOf: 3 | 5): string[] {
  const need = bestOf === 5 ? 3 : 2;
  const out: string[] = [];
  for (let lose = 0; lose < need; lose++) out.push(`${need}:${lose}`); // победа хозяев
  for (let lose = need - 1; lose >= 0; lose--) out.push(`${lose}:${need}`); // победа гостей
  return out;
}
