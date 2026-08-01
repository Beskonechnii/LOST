import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamProfile, type RosterMember } from "@/lib/roster-data";
import { getStandings } from "@/lib/standings";
import { DIVISIONS, divisionSlug } from "@/lib/divisions";
import { teamAccent, teamTag } from "@/lib/profiles";
import { roleLabel } from "@/lib/roles";
import { QUALIFICATION, qualificationOf } from "@/lib/qualification";
import { isAdmin } from "@/lib/admin-session";
import { Eyebrow, StatTile } from "@/app/_components/ui";
import { PlayerMiniCard } from "../../_components/player-card";
import { TeamCover } from "../../_components/team-cover";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await getTeamProfile(Number(id));
  if (!team) notFound();

  // Таблицу берём по дивизиону команды — тому же, что показывает раздел «LOST D1»/«LOST D2».
  const divSlug = divisionSlug(team.group);
  const [standings, authed] = await Promise.all([getStandings(team.group ?? DIVISIONS[0].name), isAdmin()]);

  const accent = teamAccent(team);
  const core = team.players.filter((p) => p.position !== null);
  const staff = team.players.filter((p) => p.position === null);

  // Место берём из общей таблицы, а не считаем заново: один источник с разделом «LOST D1».
  const group = standings.find((g) => g.rows.some((r) => r.teamId === team.id));
  const row = group?.rows.find((r) => r.teamId === team.id) ?? null;
  const zone = row?.place ? qualificationOf(row.place, group!.rows.length) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-subtle">
        <Link href="/roster/teams" className="hover:text-ink-muted">
          Команды
        </Link>
        <span className="text-ink-subtle">/</span>
        <span className="text-ink-muted">{team.name}</span>
      </div>

      {/* Обложка: командное фото, если оно есть; иначе — градиент в цвет команды с лого водяным знаком */}
      <section className="overflow-hidden rounded-2xl border border-hairline bg-canvas">
        <TeamCover team={team} accent={accent} />

        {/* Лого наезжает на обложку — тот же приём, что с аватаркой игрока: шапка и тело срастаются.
            На узком экране всё складывается в столбик: имена команд длинные, в строку они не влезают. */}
        {/* relative обязателен: подложки обложки позиционированные, без него они перекрывают заголовок */}
        <div className="relative -mt-12 flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-end sm:gap-4">
          <div
            className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-canvas p-2"
            style={{ borderColor: `${accent}66` }}
          >
            {team.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logo} alt={team.name} className="h-full w-full object-contain" />
            ) : (
              <span className="text-lg font-bold text-ink-subtle">{teamTag(team)}</span>
            )}
          </div>

          <div className="min-w-0 flex-1 sm:pb-1">
            <h1 className="text-3xl font-bold leading-tight tracking-tight break-words">{team.name}</h1>
            <p className="text-sm text-ink-subtle">
              {[teamTag(team), team.group, `${team.playersCount} игрок(ов)`].filter(Boolean).join(" · ")}
            </p>
            {team.mmrAverage !== null && (
              <p className="text-sm text-ink-muted">
                ср. MMR основы <span className="font-medium text-ink">{team.mmrAverage.toLocaleString("ru")}</span>
                <span className="text-ink-subtle"> · Σ {team.mmrTotal.toLocaleString("ru")}</span>
              </p>
            )}
          </div>

          {authed && (
            <Link
              href={`/admin/roster/teams/${team.id}/edit`}
              className="self-start rounded bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-bright sm:mb-1 sm:self-auto"
            >
              Редактировать
            </Link>
          )}
        </div>
      </section>

      {/* Участие в дивизионе: цифры те же, что в разделе «LOST D1», и переходы туда же */}
      {row && (
        <section className="rounded-2xl border border-hairline bg-surface-1 p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_14px_40px_-24px_rgba(0,0,0,0.9)]">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <Eyebrow>
              {team.group ?? "Дивизион"}
              {group && <span className="ml-2 text-ink-muted">группа {group.group}</span>}
            </Eyebrow>
            <div className="flex flex-wrap gap-3 text-xs">
              <Link href={`/standings/${divSlug}`} className="font-medium text-accent-bright hover:underline">
                Групповая стадия →
              </Link>
              <Link href={`/standings/${divSlug}/playoff`} className="font-medium text-accent-bright hover:underline">
                Плей-офф →
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {row.place && (
              <StatTile accent label="Место" value={`${row.place}`} hint={group ? `из ${group.rows.length}` : undefined} />
            )}
            <StatTile label="В — П" value={`${row.wins} — ${row.losses}`} hint={`${row.played} серий`} />
            <StatTile label="Очки" value={row.points.toLocaleString("ru")} />
            {/* цвет зоны — общий для всех мест, где показываем группу (qualification.ts) */}
            {zone && <StatTile label="Зона" value={QUALIFICATION[zone].label} valueClass={QUALIFICATION[zone].text} />}
          </div>
        </section>
      )}

      <RosterSection title="Основа" players={core} accent={accent} empty="Основа не заведена." />
      {staff.length > 0 && <RosterSection title="Штаб" players={staff} accent={accent} empty="" />}
    </div>
  );
}

function RosterSection({
  title,
  players,
  accent,
  empty,
}: {
  title: string;
  players: RosterMember[];
  accent: string;
  empty: string;
}) {
  return (
    <section>
      <Eyebrow className="mb-3">{title}</Eyebrow>
      {players.length === 0 ? (
        <p className="text-sm text-ink-subtle">{empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => (
            <PlayerMiniCard
              key={p.id}
              id={p.id}
              nickname={p.nickname}
              photo={p.photo}
              accent={accent}
              role={roleLabel(p.role) ?? "роль не задана"}
              mmr={p.mmr}
              isCaptain={p.isCaptain}
              country={p.country}
              size={56}
              trailing={
                p.position ? (
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-hairline bg-surface-2 text-xs font-semibold text-ink-muted">
                    {p.position}
                  </span>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
