// СЕРВЕР: сборка графики серии из мастер-шаблона. Мастер (Design с kind и пустым seriesId) —
// свободная раскладка редактора, часть слоёв помечена привязкой (src/studio/editor/model.ts:Binding).
// Здесь по серии собираем контекст данных и подставляем его в привязанные слои — получается doc
// готовой графики этой серии. Клон + подстановка, ничего не рендерим (PNG клиентский).
import { prisma } from "@/lib/prisma";
import { withTeamUploads, withPlayerUploads } from "@/lib/uploads";
import { ROLES } from "@/lib/roles";
import type { DesignDoc, Element, BindingField } from "@/studio/editor/model";

// Формат по стадии, когда в серии не задан руками: гранд-финал — bo5, плей-офф — bo3, группа — bo2.
function formatByStage(stage: string, bracket: string | null): string {
  if (bracket === "grand") return "bo5";
  return stage === "playoff" ? "bo3" : "bo2";
}

/** Материал-ярлык стадии: PLAY-OFF или GROUP A/B — берём его url из медиатеки. */
async function stageLabelUrl(stage: string, group: string | null): Promise<string | undefined> {
  const name = stage === "group" ? `GROUP ${(group ?? "A").toUpperCase()}` : "PLAY-OFF";
  const asset = await prisma.mediaAsset.findFirst({ where: { name } });
  return asset?.url;
}

const roleIndex = (role: string | null) => {
  const i = ROLES.findIndex((r) => r.key === role);
  return i < 0 ? ROLES.length : i;
};

type SpotWithPlayer = { isCaptain: boolean; role: string | null; player: { slug: string; nickname: string; photo: string | null } };

/** Представитель команды для фото-анонса: капитан → по позиции (керри…хард); с фото — приоритетно. */
async function pickFeatured(spots: SpotWithPlayer[], teamName: string): Promise<PlayerCtx> {
  const ordered = [...spots].sort(
    (a, b) => Number(b.isCaptain) - Number(a.isCaptain) || roleIndex(a.role) - roleIndex(b.role),
  );
  const resolved = await Promise.all(ordered.map((s) => withPlayerUploads(s.player)));
  const chosen = resolved.find((p) => p.photo) ?? resolved[0];
  if (!chosen) return {};
  return { photo: chosen.photo ?? undefined, nickname: chosen.nickname, teamName };
}

type TeamCtx = { name: string; logo?: string; wordmark?: string };
type PlayerCtx = { photo?: string; nickname?: string; teamName?: string };

/** Контекст данных серии: значения под каждую привязку. undefined = «нет данных, оставить как в мастере». */
export type SeriesData = {
  teamA: TeamCtx;
  teamB: TeamCtx;
  playerA: PlayerCtx;
  playerB: PlayerCtx;
  series: { scoreA?: string; scoreB?: string; time?: string; format?: string; stageLabel?: string };
  winnerSide: "A" | "B" | null; // кто победил в серии (для бейджа над командой); null — ещё нет
  title: string; // подпись создаваемого Design
};

export async function buildSeriesData(seriesId: number, throughMap?: number): Promise<SeriesData | null> {
  const s = await prisma.series.findUnique({ where: { id: seriesId }, include: { home: true, away: true } });
  if (!s) return null;

  // Счёт: по умолчанию — итоговый серии; для графики счёта по карте N — накопительный до карты N
  // включительно (после карты 2 может быть 1:1). Считаем из победителей карт (Match.winnerTeamId).
  let scoreA = s.homeScore;
  let scoreB = s.awayScore;
  if (throughMap != null) {
    const games = await prisma.match.findMany({
      where: { seriesId, gameNumber: { lte: throughMap } },
      select: { winnerTeamId: true },
    });
    scoreA = games.filter((g) => g.winnerTeamId === s.homeId).length;
    scoreB = games.filter((g) => g.winnerTeamId === s.awayId).length;
  }

  const spots = await prisma.rosterSpot.findMany({
    where: { teamId: { in: [s.homeId, s.awayId] } },
    include: { player: { select: { slug: true, nickname: true, photo: true } } },
  });

  const [home, away, stage, playerA, playerB] = await Promise.all([
    withTeamUploads(s.home),
    withTeamUploads(s.away),
    stageLabelUrl(s.stage, s.group),
    pickFeatured(spots.filter((sp) => sp.teamId === s.homeId), s.home.name),
    pickFeatured(spots.filter((sp) => sp.teamId === s.awayId), s.away.name),
  ]);

  const time = s.startAt
    ? s.startAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : undefined;

  return {
    teamA: { name: home.name, logo: home.logo ?? undefined, wordmark: home.wordmark ?? undefined },
    teamB: { name: away.name, logo: away.logo ?? undefined, wordmark: away.wordmark ?? undefined },
    playerA,
    playerB,
    series: {
      scoreA: String(scoreA),
      scoreB: String(scoreB),
      time,
      format: s.format ?? formatByStage(s.stage, s.bracket),
      stageLabel: stage,
    },
    winnerSide: s.homeScore > s.awayScore ? "A" : s.awayScore > s.homeScore ? "B" : null,
    title: `${s.home.name} vs ${s.away.name}`,
  };
}

// Поля-картинки идут в src, остальные — в text (совпадает с IMAGE_FIELDS в Inspector).
const IMAGE_FIELDS: BindingField[] = ["logo", "wordmark", "photo", "stageLabel"];

/** Значение под привязку из контекста; undefined — оставить исходное значение слоя. */
function valueFor(field: BindingField, source: string, data: SeriesData): string | undefined {
  const team = source === "teamA" ? data.teamA : source === "teamB" ? data.teamB : null;
  if (team) {
    if (field === "name") return team.name;
    if (field === "logo") return team.logo;
    if (field === "wordmark") return team.wordmark;
  }
  const player = source === "playerA" ? data.playerA : source === "playerB" ? data.playerB : null;
  if (player) {
    if (field === "photo") return player.photo;
    if (field === "nickname") return player.nickname;
    if (field === "teamName") return player.teamName;
  }
  if (source === "series") return data.series[field as keyof SeriesData["series"]];
  return undefined;
}

/** Клонирует doc и подставляет данные серии в привязанные слои. */
export function fillDoc(doc: DesignDoc, data: SeriesData): DesignDoc {
  const elements: Element[] = doc.elements.map((el) => {
    if (!el.binding) return el;
    // бейдж победителя: автор ставит его над левой командой; при победе правой — зеркалим по холсту,
    // при отсутствии победителя (ничья/серия не сыграна) — прячем. Src остаётся авторский (WINNER).
    if (el.binding.field === "winnerBadge") {
      if (data.winnerSide == null) return { ...el, hidden: true };
      return { ...el, hidden: false, x: data.winnerSide === "B" ? doc.w - el.x - el.w : el.x };
    }
    const value = valueFor(el.binding.field, el.binding.source, data);
    if (value == null) return el; // нет данных — оставляем как в мастере
    if (IMAGE_FIELDS.includes(el.binding.field)) {
      return el.type === "image" ? { ...el, src: value } : el;
    }
    // текст: подставляем значение; усадку под ширину бокса делает рендер (TextEl.autoFit в ElementView)
    return el.type === "text" ? { ...el, text: value } : el;
  });
  return { ...doc, elements };
}
