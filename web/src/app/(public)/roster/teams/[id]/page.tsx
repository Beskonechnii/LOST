import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamProfile, type RosterMember } from "@/lib/roster-data";
import { getStandings } from "@/lib/standings";
import { teamDivision } from "@/lib/tournaments";
import { teamAccent, teamTag } from "@/lib/profiles";
import { buttonClasses } from "@/components/pouf/Button";
import { roleLabel } from "@/lib/roles";
import { QUALIFICATION, qualificationOf } from "@/lib/qualification";
import { can } from "@/lib/account";
import { Eyebrow, StatTile } from "@/app/_components/ui";
import { PlayerMiniCard } from "../../_components/player-card";
import { TeamCover } from "../../_components/team-cover";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await getTeamProfile(Number(id));
  if (!team) notFound();

  // Таблицу берём по дивизиону команды в текущем турнире — тому же, что показывает его раздел.
  // Команда вне турнира (например, из прошлого сезона) таблицы не получает — это не ошибка.
  const division = await teamDivision(team.id);
  const [standings, authed] = await Promise.all([
    division ? getStandings(division.id) : Promise.resolve([]),
    can("roster.edit"),
  ]);

  const accent = teamAccent(team);
  const core = team.players.filter((p) => p.position !== null);
  const staff = team.players.filter((p) => p.position === null);

  // Место берём из общей таблицы, а не считаем заново: один источник с разделом «LOST D1».
  const group = standings.find((g) => g.rows.some((r) => r.teamId === team.id));
  const row = group?.rows.find((r) => r.teamId === team.id) ?? null;
  const zone = row?.place && division ? qualificationOf(row.place, group!.rows.length, division.relegation) : null;

  return (
    <div className="space-y-6 font-pouf">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-muted">
        <Link href="/roster/teams" className="hover:text-[var(--purple)]">
          Команды
        </Link>
        <span className="text-ink-subtle">/</span>
        <span className="text-ink-muted">{team.name}</span>
      </div>

      {/* Обложка: командное фото, если оно есть; иначе — градиент в цвет команды с лого водяным знаком */}
      <section className="overflow-hidden rounded-card bg-canvas cushion-card">
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
            <h1 className="text-3xl font-black leading-tight tracking-[-0.5px] break-words text-ink">{team.name}</h1>
            <p className="text-sm font-bold text-muted">
              {[teamTag(team), team.group, `${team.playersCount} игрок(ов)`].filter(Boolean).join(" · ")}
            </p>
            {team.mmrAverage !== null && (
              <p className="text-sm font-bold text-ink-muted">
                ср. MMR основы <span className="font-black text-ink">{team.mmrAverage.toLocaleString("ru")}</span>
                <span className="text-muted"> · Σ {team.mmrTotal.toLocaleString("ru")}</span>
              </p>
            )}
          </div>

          {authed && (
            <Link href={`/admin/roster/teams/${team.id}/edit`} className={`${buttonClasses({ size: "sm" })} self-start sm:mb-1 sm:self-auto`}>
              Редактировать
            </Link>
          )}
        </div>
      </section>

      {/* Участие в дивизионе: цифры те же, что в разделе «LOST D1», и переходы туда же */}
      {row && (
        <section className="rounded-card bg-surface p-5 cushion-card">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <Eyebrow>
              {division?.label ?? division?.name ?? "Дивизион"}
              {group && <span className="ml-2 text-ink-muted">группа {group.group}</span>}
            </Eyebrow>
            <div className="flex flex-wrap gap-3 text-xs">
              <Link
                href={`/tournaments/${division!.tournament.slug}/${division!.slug}/groups`}
                className="font-black text-[var(--purple)] hover:underline"
              >
                Групповая стадия →
              </Link>
              <Link
                href={`/tournaments/${division!.tournament.slug}/${division!.slug}/playoff`}
                className="font-black text-[var(--purple)] hover:underline"
              >
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
        <p className="text-sm font-bold text-muted">{empty}</p>
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
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[12px] bg-surface-2 text-xs font-black text-ink-muted cushion-field">
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
