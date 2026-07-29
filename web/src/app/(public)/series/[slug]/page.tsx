import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Icon, TeamCrest } from "@/app/_components/postgame/blocks";
import { BackButton } from "./_components/back-button";
import { divisionSlug } from "@/lib/divisions";
import { getSeriesDetail, type GamePlayer, type SeriesDetail, type SeriesGameDetail } from "@/lib/series";
import { playoffLabel, stageLabel } from "@/lib/stages";

export const dynamic = "force-dynamic";

// Страница встречи: шапка со счётом серии и карты одна под другой, у каждой — оба состава.
// Форма взята с разбора серии на Dotabuff: за один экран видно и исход серии, и кто как сыграл
// на каждой карте. Детали карты (драфт, предметы, график) не дублируем — за ними ведёт /match/<id>.

type Team = SeriesDetail["home"];

const clock = (sec: number | null) => (sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "—");

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = await getSeriesDetail((await params).slug);
  if (!s) return { title: "Встреча не найдена" };
  return { title: `${s.home.name} — ${s.away.name}`, description: `${s.division}, ${stageLabel(s.stage)}` };
}

/** Подпись разреза: «Группа A» либо «Верхняя сетка · Полуфинал». */
function cutLabel(s: SeriesDetail) {
  if (s.stage === "group") return s.group ? `Группа ${s.group}` : "Групповая стадия";
  return playoffLabel(s.bracket, s.round) || "Плей-офф";
}

/** Половина шапки: герб, тег и название. Проигравшая сторона приглушена, ничья — обе нейтральны. */
function SeriesSide({ team, winnerId, align }: { team: Team; winnerId: number | null; align: "left" | "right" }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <TeamCrest logo={team.logo} name={team.name} size={56} />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-widest text-neutral-500">{team.tag}</div>
        <Link
          href={`/roster/teams/${team.id}`}
          className={`block truncate text-lg font-bold hover:underline ${
            winnerId === team.id ? "text-emerald-400"
            : winnerId ? "text-neutral-400"
            : "text-neutral-200"
          }`}
        >
          {team.name}
        </Link>
      </div>
    </div>
  );
}

function PlayerRow({ p, won }: { p: GamePlayer; won: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1">
      {p.heroSlug ?
        <Icon kind="heroes" slug={p.heroSlug} name={p.heroSlug} h={22} />
      : <span className="h-[22px] w-[39px] shrink-0 rounded-sm bg-neutral-800" />}
      <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-neutral-500" title="уровень">
        {p.level || "—"}
      </span>
      <span className={`truncate text-sm ${won ? "text-neutral-200" : "text-neutral-400"}`}>{p.nickname}</span>
      <span className="ml-auto shrink-0 text-xs tabular-nums">
        <span className="text-emerald-400">{p.kills}</span>
        <span className="text-neutral-600"> / </span>
        <span className="text-rose-400">{p.deaths}</span>
        <span className="text-neutral-600"> / </span>
        <span className="text-sky-400">{p.assists}</span>
      </span>
    </div>
  );
}

/** Состав одной команды на карте: сторона, первый пик, исход и пятёрка. */
function GameTeam({ team, game, firstPickTeamId }: { team: Team; game: SeriesGameDetail; firstPickTeamId: number | null }) {
  const won = game.winnerTeamId === team.id;
  const isRadiant = game.radiantTeamId === team.id;
  const players = game.byTeam[team.id] ?? [];
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex flex-wrap items-baseline gap-2 border-b border-neutral-800 pb-1">
        <span className={`text-sm font-bold ${won ? "text-emerald-400" : "text-neutral-400"}`}>{team.name}</span>
        {game.radiantTeamId != null && (
          <span className={`text-[10px] uppercase tracking-widest ${isRadiant ? "text-emerald-500/80" : "text-rose-500/80"}`}>
            {isRadiant ? "Свет" : "Тьма"}
          </span>
        )}
        {firstPickTeamId === team.id && <span className="text-[10px] text-neutral-500">первый пик</span>}
        {won && <span className="ml-auto text-[10px] uppercase tracking-widest text-emerald-500">победа</span>}
      </div>
      {players.length ?
        players.map((p) => <PlayerRow key={p.playerId} p={p} won={won} />)
      : <p className="py-2 text-[11px] text-neutral-600">Игроков этой команды нет в ростере — стата не легла.</p>}
      {/* В архив попадают только игроки лиги: у стендина нет анкеты, а значит и строки статы. */}
      {players.length > 0 && players.length < 5 && (
        <p className="pt-1 text-[10px] text-neutral-600">
          ещё {5 - players.length} в ростере не заведён{5 - players.length > 1 ? "ы" : ""}
        </p>
      )}
    </div>
  );
}

function GameCard({ game, home, away }: { game: SeriesGameDetail; home: Team; away: Team }) {
  const homeRadiant = game.radiantTeamId === home.id;
  // Счёт по убийствам хранится по сторонам, а показываем по командам — разворачиваем.
  const homeKills = homeRadiant ? game.radiantScore : game.direScore;
  const awayKills = homeRadiant ? game.direScore : game.radiantScore;
  const firstPickTeamId =
    game.firstPickRadiant == null ? null
    : game.firstPickRadiant === homeRadiant ? home.id
    : away.id;

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 bg-neutral-900/60 px-4 py-2">
        <span className="text-sm font-bold text-neutral-300">#{game.gameNumber ?? "?"}</span>
        {game.openDotaMatchId && (
          <Link href={`/match/${game.openDotaMatchId}`} className="text-xs text-violet-400 hover:underline">
            {game.openDotaMatchId}
          </Link>
        )}
        <span className="text-xs tabular-nums text-neutral-500">{clock(game.durationSec)}</span>
        {homeKills != null && awayKills != null && (
          <span className="text-sm font-bold tabular-nums">
            <span className={game.winnerTeamId === home.id ? "text-emerald-400" : "text-neutral-500"}>{homeKills}</span>
            <span className="mx-1 text-neutral-700">—</span>
            <span className={game.winnerTeamId === away.id ? "text-emerald-400" : "text-neutral-500"}>{awayKills}</span>
          </span>
        )}
        {game.startedAt && <span className="ml-auto text-[11px] text-neutral-600">{dateFmt.format(game.startedAt)}</span>}
      </div>
      <div className="flex flex-col gap-4 p-4 md:flex-row md:gap-8">
        <GameTeam team={home} game={game} firstPickTeamId={firstPickTeamId} />
        <GameTeam team={away} game={game} firstPickTeamId={firstPickTeamId} />
      </div>
    </section>
  );
}

export default async function SeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  // Ключ в адресе — слаг встречи, а не id: id автоинкрементный и после `db:import` другой,
  // так что ссылка ломалась бы на каждом переносе данных. Числовой id тоже принимаем — на случай
  // ссылок, отданных до появления слагов.
  const { slug } = await params;
  const s = await getSeriesDetail(slug);
  if (!s) notFound();

  const div = divisionSlug(s.division);
  const winner = s.homeScore > s.awayScore ? s.home.id : s.awayScore > s.homeScore ? s.away.id : null;
  const bo = s.homeScore + s.awayScore <= 1 ? "Bo1" : "Bo3";

  return (
    <main className="flex-1 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <BackButton fallback={`/standings/${div}`} />
        {/* шапка-крошки: дивизион и разрез — то, что на Dotabuff занимает строку лиги */}
        <div className="!mt-3 flex flex-wrap items-center justify-between gap-2 rounded-t-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href={`/standings/${div}`} className="font-medium text-violet-400 hover:underline">
              {s.division}
            </Link>
            <span className="text-neutral-700">·</span>
            <span className="text-neutral-400">{cutLabel(s)}</span>
          </div>
          <span className="text-xs text-neutral-600">{s.slug}</span>
        </div>

        <div className="!mt-0 rounded-b-xl border border-t-0 border-neutral-800 bg-neutral-900/40 p-4">
          <div className="flex items-center gap-4">
            <SeriesSide team={s.home} winnerId={winner} align="left" />
            <div className="shrink-0 text-center">
              <div className="text-3xl font-black tabular-nums">
                <span className={winner === s.home.id ? "text-emerald-400" : "text-neutral-400"}>{s.homeScore}</span>
                <span className="mx-2 text-neutral-700">—</span>
                <span className={winner === s.away.id ? "text-emerald-400" : "text-neutral-400"}>{s.awayScore}</span>
              </div>
              <div className="mt-1 text-[11px] text-neutral-500">
                {bo}
                {s.playedAt ? ` · ${dateFmt.format(s.playedAt)}` : ""}
              </div>
              {s.guessed && <div className="mt-1 text-[10px] text-amber-400">счёт под вопросом</div>}
            </div>
            <SeriesSide team={s.away} winnerId={winner} align="right" />
          </div>
        </div>

        <h2 className="pt-2 text-xs uppercase tracking-widest text-neutral-400">Карты</h2>

        {s.games.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-800 p-6 text-sm text-neutral-400">
            К этой встрече ещё не привязано ни одной карты — известен только счёт серии.
          </p>
        )}

        {s.games.map((g) => (
          <GameCard key={g.matchId} game={g} home={s.home} away={s.away} />
        ))}
      </div>
    </main>
  );
}
