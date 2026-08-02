// Только сервер: сборка сетки плей-офф из живых данных. Шаблон сетки (кто с кем и куда падает) —
// чистые данные в playoff-bracket.ts; здесь они наполняются командами: сиды берём из групп, а
// участников поздних слотов вычисляем из исходов ранних (победитель идёт дальше, проигравший
// падает вниз или вылетает). Ничего не хранится — сетка это отражение архива серий.

import { getQualified } from "@/lib/group-stage";
import { listSeries, type SeriesRow } from "@/lib/series";
import { PLAYOFF_SLOTS, PLAYOFF_ROUND_COLUMNS, slotByKey, type SlotSource } from "@/lib/playoff-bracket";
import type { Bracket } from "@/lib/stages";

export type SlotTeam = { teamId: number; name: string; tag: string; logo: string | null };

/** Сторона слота: конкретная команда либо заглушка («Победитель ЧФ-1», «A1» до старта). */
export type SlotSide = {
  team: SlotTeam | null;
  /** Подпись, когда команды ещё нет: посев («A1») или ожидаемый исход другого слота. */
  placeholder: string | null;
  score: number | null;
};

export type ResolvedSlot = {
  key: string;
  bracket: Bracket;
  round: string;
  label: string;
  bestOf: 3 | 5;
  a: SlotSide;
  b: SlotSide;
  /** Слаг заведённой серии — ссылка на встречу; null, если её ещё нет. */
  seriesSlug: string | null;
  /** Итог, когда серия сыграна: победитель уходит дальше, проигравший — вниз/вылет. */
  winner: SlotTeam | null;
  loser: SlotTeam | null;
  /** Техпоражение: счёт до большинства не добит (0:1). В сетке показываем не цифры, а W/L. */
  walkover: boolean;
  /** Куда падает проигравший: ключ слота нижней сетки или null (вылет). */
  loserTo: string | null;
};

export type ResolvedBracket = {
  slots: ResolvedSlot[];
  columns: { bracket: Bracket; round: string }[];
  /** Не прошедшие в плей-офф из групп — вылет ещё до сетки. */
  out: (SlotTeam & { group: string; place: number })[];
  /** Достаточно ли залита групповая стадия, чтобы был посев. */
  seeded: boolean;
};

/**
 * Серия сыграна — берём просто неравный счёт: в архив пишут финальный результат встречи, а не
 * ведут её вживую. Так корректно учитываются и техпоражения (у BBC в D1 это «1:0»), которые до
 * большинства карт не добиты, но исход у них решён.
 */
function decided(s: SeriesRow) {
  return s.homeScore !== s.awayScore;
}

/**
 * Разбор сетки дивизиона: наполняем шаблон командами. Сиды — из групп (1–4 верхняя, 5–6 нижняя),
 * поздние слоты — по исходам ранних. Считаем один проход сверху вниз: слоты в шаблоне уже идут
 * в турнирном порядке, поэтому к моменту разбора слота его источники-слоты уже разобраны.
 */
export async function resolveBracket(division: string): Promise<ResolvedBracket> {
  const [{ upper, lower, out }, series] = await Promise.all([
    getQualified(division),
    listSeries({ division, stage: "playoff" }),
  ]);

  // Посев по «группа+место»: одно значение и в верхней, и в нижней сетке шаблона.
  const seeds = new Map<string, SlotTeam>();
  for (const r of [...upper, ...lower]) {
    seeds.set(`${r.group}${r.place}`, { teamId: r.teamId, name: r.name, tag: r.tag, logo: r.logo });
  }
  const teamById = new Map<number, SlotTeam>([...seeds.values()].map((t) => [t.teamId, t]));

  const seriesBySlot = new Map<string, SeriesRow>();
  for (const s of series) if (s.slot) seriesBySlot.set(s.slot, s);

  // Итоги уже разобранных слотов — источник для winner/loser поздних слотов.
  const winnerOf = new Map<string, SlotTeam>();
  const loserOf = new Map<string, SlotTeam>();

  const sideFromSource = (src: SlotSource): SlotSide => {
    if (src.kind === "seed") {
      const team = seeds.get(`${src.group}${src.place}`) ?? null;
      return { team, placeholder: team ? null : `${src.group}${src.place}`, score: null };
    }
    const from = src.kind === "winner" ? winnerOf : loserOf;
    const team = from.get(src.slot) ?? null;
    const label = slotByKey(src.slot)?.label ?? src.slot;
    const word = src.kind === "winner" ? "Победитель" : "Проигравший";
    return { team, placeholder: team ? null : `${word} ${label}`, score: null };
  };

  const slots: ResolvedSlot[] = PLAYOFF_SLOTS.map((def) => {
    const a = sideFromSource(def.a);
    const b = sideFromSource(def.b);
    const s = seriesBySlot.get(def.key) ?? null;

    let winner: SlotTeam | null = null;
    let loser: SlotTeam | null = null;
    let walkover = false;

    if (s) {
      // Команды и счёт берём из заведённой серии — она источник правды о том, кто реально сыграл.
      const home = teamById.get(s.home.id) ?? { teamId: s.home.id, name: s.home.name, tag: s.home.tag, logo: s.home.logo };
      const away = teamById.get(s.away.id) ?? { teamId: s.away.id, name: s.away.name, tag: s.away.tag, logo: s.away.logo };
      // Порядок сторон подгоняем под шаблон: если по источникам сторона A — это гость серии, меняем.
      const swap = a.team?.teamId === s.away.id || b.team?.teamId === s.home.id;
      const [sideAteam, sideAscore, sideBteam, sideBscore] = swap
        ? [away, s.awayScore, home, s.homeScore]
        : [home, s.homeScore, away, s.awayScore];
      a.team = sideAteam;
      a.placeholder = null;
      a.score = sideAscore;
      b.team = sideBteam;
      b.placeholder = null;
      b.score = sideBscore;

      if (decided(s)) {
        const homeWon = s.homeScore > s.awayScore;
        winner = homeWon ? home : away;
        loser = homeWon ? away : home;
        winnerOf.set(def.key, winner);
        loserOf.set(def.key, loser);
        // Техпоражение: победитель не добрал карт до большинства (напр. 0:1 при Bo3) — это форфейт.
        const need = def.bestOf === 5 ? 3 : 2;
        walkover = Math.max(s.homeScore, s.awayScore) < need;
      }
    }

    return {
      key: def.key,
      bracket: def.bracket,
      round: def.round,
      label: def.label,
      bestOf: def.bestOf,
      a,
      b,
      seriesSlug: s?.slug ?? null,
      winner,
      loser,
      walkover,
      loserTo: def.loserTo,
    };
  });

  const outTeams = out.map((r) => ({ teamId: r.teamId, name: r.name, tag: r.tag, logo: r.logo, group: r.group, place: r.place }));

  return { slots, columns: PLAYOFF_ROUND_COLUMNS, out: outTeams, seeded: seeds.size > 0 };
}
