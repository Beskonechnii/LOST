// Ядро fearless-драфта — чистые функции без БД (как qualification.ts / draft.ts), годятся на клиенте.
// Fearless = «без повторов по серии»: герой, ВЗЯТЫЙ (pick) в любой прошлой карте серии, больше не
// доступен для взятия до конца серии. Баны — покарточные, каждую карту сбрасываются.
//
// Состояние эфемерное (борд оператора), в БД пока не хранится — живёт в компоненте/URL. Поэтому
// здесь только правила и типы, без загрузки/сохранения.

export const FEARLESS_VERSION = 1 as const;

/** Сторона драфта: 0 — первый пик/бан, 1 — второй. Имя/цвет берём из выбранных команд. */
export type Side = 0 | 1;
export type FearlessTeam = { name: string; color: string };

/** Шаг последовательности карты: чья очередь и что делает. */
export type Step = { side: Side; action: "ban" | "pick" };

// Стандартная CM-lite: 4 бана и 5 пиков на команду за карту (18 героев). Легко переписать под свой
// регламент — движок не зависит от конкретного порядка, только от этого массива. F = сторона 0, S = 1.
export const SEQUENCE: Step[] = [
  { side: 0, action: "ban" }, { side: 1, action: "ban" }, { side: 0, action: "ban" }, { side: 1, action: "ban" },
  { side: 0, action: "pick" }, { side: 1, action: "pick" }, { side: 1, action: "pick" }, { side: 0, action: "pick" },
  { side: 0, action: "ban" }, { side: 1, action: "ban" }, { side: 0, action: "ban" }, { side: 1, action: "ban" },
  { side: 1, action: "pick" }, { side: 0, action: "pick" }, { side: 0, action: "pick" }, { side: 1, action: "pick" },
  { side: 0, action: "pick" }, { side: 1, action: "pick" },
];

/** Одно взятие/бан: сторона + герой (id справочника localHeroes). */
export type Move = { side: Side; heroId: number; action: "ban" | "pick" };

/** Драфт одной карты серии. `first` — кто пикает первым на этой карте (стороны меняются по картам). */
export type GameDraft = { moves: Move[] };

export type FearlessState = {
  version: typeof FEARLESS_VERSION;
  teams: [FearlessTeam, FearlessTeam];
  bestOf: number; // сколько карт максимум в серии (1/2/3/5) — просто ограничивает добавление карт
  games: GameDraft[]; // одна запись на карту; games[0] — первая карта
  current: number; // индекс текущей карты в games
};

/** Новый драфт серии: две команды, длина серии. Первая карта уже заведена. */
export function newFearless(teams: [FearlessTeam, FearlessTeam], bestOf = 3): FearlessState {
  return { version: FEARLESS_VERSION, teams, bestOf, games: [{ moves: [] }], current: 0 };
}

/**
 * Кто пикает первым на карте с индексом gameIdx. Стороны чередуются по картам: на нечётных
 * первый пик уходит второй команде — так серия честнее (никто не пикает первым всю серию).
 */
export const firstSideOf = (gameIdx: number): Side => (gameIdx % 2 === 0 ? 0 : 1);

/**
 * Развёртка шагов карты с учётом того, кто ходит первым: если первой карту начинает сторона 1,
 * стороны в SEQUENCE зеркалятся. Возвращает шаги в порядке исполнения.
 */
export function stepsFor(gameIdx: number): Step[] {
  const swap = firstSideOf(gameIdx) === 1;
  return swap ? SEQUENCE.map((s) => ({ ...s, side: (s.side === 0 ? 1 : 0) as Side })) : SEQUENCE;
}

/** Текущий шаг карты (что делать сейчас) или null, если драфт карты завершён. */
export function currentStep(state: FearlessState): Step | null {
  const game = state.games[state.current];
  if (!game) return null;
  const steps = stepsFor(state.current);
  return steps[game.moves.length] ?? null;
}

/** Герои, ВЗЯТЫЕ в прошлых картах серии — недоступны до конца серии (суть fearless). */
export function fearlessLocked(state: FearlessState): Set<number> {
  const set = new Set<number>();
  state.games.forEach((g, i) => {
    if (i === state.current) return; // текущая карта считается отдельно (bansThisGame/picksThisGame)
    for (const m of g.moves) if (m.action === "pick") set.add(m.heroId);
  });
  return set;
}

/** Забанено на текущей карте (баны — покарточные). */
export function bansThisGame(state: FearlessState): Set<number> {
  const g = state.games[state.current];
  return new Set(g ? g.moves.filter((m) => m.action === "ban").map((m) => m.heroId) : []);
}

/** Взято на текущей карте. */
export function picksThisGame(state: FearlessState): Set<number> {
  const g = state.games[state.current];
  return new Set(g ? g.moves.filter((m) => m.action === "pick").map((m) => m.heroId) : []);
}

/** Можно ли сейчас выбрать этого героя: не забанен, не взят на карте и не заблокирован fearless. */
export function isSelectable(state: FearlessState, heroId: number): boolean {
  if (currentStep(state) === null) return false;
  if (fearlessLocked(state).has(heroId)) return false;
  if (bansThisGame(state).has(heroId)) return false;
  if (picksThisGame(state).has(heroId)) return false;
  return true;
}

/** Применить текущий шаг к герою. Возвращает НОВОЕ состояние (иммутабельно). Нелегальный ход — без изменений. */
export function applyPick(state: FearlessState, heroId: number): FearlessState {
  const step = currentStep(state);
  if (!step || !isSelectable(state, heroId)) return state;
  const games = state.games.map((g, i) =>
    i === state.current ? { moves: [...g.moves, { side: step.side, heroId, action: step.action }] } : g,
  );
  return { ...state, games };
}

/** Отменить последний ход текущей карты (кнопка «назад»). */
export function undo(state: FearlessState): FearlessState {
  const g = state.games[state.current];
  if (!g || g.moves.length === 0) return state;
  const games = state.games.map((gg, i) => (i === state.current ? { moves: gg.moves.slice(0, -1) } : gg));
  return { ...state, games };
}

/** Завершён ли драфт текущей карты (все шаги сделаны). */
export const isGameComplete = (state: FearlessState): boolean => currentStep(state) === null;

/** Можно ли завести ещё карту серии (текущая доиграна и лимит bestOf не достигнут). */
export const canNextGame = (state: FearlessState): boolean =>
  isGameComplete(state) && state.games.length < state.bestOf;

/** Завести следующую карту серии и перейти на неё. */
export function nextGame(state: FearlessState): FearlessState {
  if (!canNextGame(state)) return state;
  return { ...state, games: [...state.games, { moves: [] }], current: state.games.length };
}

/** Пики/баны одной стороны на текущей карте — для колонок борда. */
export function sideMoves(state: FearlessState, side: Side): { picks: number[]; bans: number[] } {
  const g = state.games[state.current];
  const picks: number[] = [];
  const bans: number[] = [];
  if (g) {
    for (const m of g.moves) {
      if (m.side !== side) continue;
      (m.action === "pick" ? picks : bans).push(m.heroId);
    }
  }
  return { picks, bans };
}
