import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamProfile, type RosterMember } from "@/lib/roster-data";
import { getStandings } from "@/lib/standings";
import { DIVISIONS, divisionSlug } from "@/lib/divisions";
import { countryCode, teamAccent, teamTag } from "@/lib/profiles";
import { roleLabel } from "@/lib/roles";
import { QUALIFICATION, qualificationOf } from "@/lib/qualification";
import { isAdmin } from "@/lib/admin-session";
import { PlayerAvatar } from "../../_components/avatar";
import { TeamCover } from "../../_components/team-cover";

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  hint,
  valueClass = "text-neutral-100",
}: {
  label: string;
  value: string;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
      <div className={`text-lg font-semibold ${valueClass}`}>{value}</div>
      {hint && <div className="text-xs text-neutral-600">{hint}</div>}
    </div>
  );
}

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
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
        <Link href="/roster/teams" className="hover:text-neutral-300">
          Команды
        </Link>
        <span className="text-neutral-700">/</span>
        <span className="text-neutral-400">{team.name}</span>
      </div>

      {/* Обложка: командное фото, если оно есть; иначе — градиент в цвет команды с лого водяным знаком */}
      <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
        <TeamCover team={team} accent={accent} />

        {/* Лого наезжает на обложку — тот же приём, что с аватаркой игрока: шапка и тело срастаются.
            На узком экране всё складывается в столбик: имена команд длинные, в строку они не влезают. */}
        {/* relative обязателен: подложки обложки позиционированные, без него они перекрывают заголовок */}
        <div className="relative -mt-12 flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-end sm:gap-4">
          <div
            className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-neutral-950 p-2"
            style={{ borderColor: `${accent}66` }}
          >
            {team.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logo} alt={team.name} className="h-full w-full object-contain" />
            ) : (
              <span className="text-lg font-bold text-neutral-500">{teamTag(team)}</span>
            )}
          </div>

          <div className="min-w-0 flex-1 sm:pb-1">
            <h1 className="text-3xl font-bold leading-tight tracking-tight break-words">{team.name}</h1>
            <p className="text-sm text-neutral-500">
              {[teamTag(team), team.group, `${team.playersCount} игрок(ов)`].filter(Boolean).join(" · ")}
            </p>
            {team.mmrAverage !== null && (
              <p className="text-sm text-neutral-400">
                ср. MMR основы <span className="font-medium text-neutral-200">{team.mmrAverage.toLocaleString("ru")}</span>
                <span className="text-neutral-600"> · Σ {team.mmrTotal.toLocaleString("ru")}</span>
              </p>
            )}
          </div>

          {authed && (
            <Link
              href={`/admin/roster/teams/${team.id}/edit`}
              className="self-start rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 sm:mb-1 sm:self-auto"
            >
              Редактировать
            </Link>
          )}
        </div>
      </section>

      {/* Участие в дивизионе: цифры те же, что в разделе «LOST D1», и переходы туда же */}
      {row && (
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xs uppercase tracking-widest text-neutral-500">
              {team.group ?? "Дивизион"}
              {group && <span className="ml-2 text-neutral-400">группа {group.group}</span>}
            </h2>
            <div className="flex flex-wrap gap-3 text-xs">
              <Link href={`/standings/${divSlug}`} className="text-violet-400 hover:underline">
                Таблица →
              </Link>
              <Link href={`/standings/${divSlug}/groups`} className="text-violet-400 hover:underline">
                Групповая стадия →
              </Link>
              <Link href={`/standings/${divSlug}/playoff`} className="text-violet-400 hover:underline">
                Плей-офф →
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {row.place && (
              <Stat label="Место" value={`${row.place}`} hint={group ? `из ${group.rows.length}` : undefined} />
            )}
            <Stat label="В — П" value={`${row.wins} — ${row.losses}`} hint={`${row.played} серий`} />
            <Stat label="Очки" value={row.points.toLocaleString("ru")} />
            {/* цвет зоны — общий для всех мест, где показываем группу (qualification.ts) */}
            {zone && <Stat label="Зона" value={QUALIFICATION[zone].label} valueClass={QUALIFICATION[zone].text} />}
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
      <h2 className="mb-3 text-xs uppercase tracking-widest text-neutral-500">{title}</h2>
      {players.length === 0 ? (
        <p className="text-sm text-neutral-500">{empty}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => (
            <Link
              key={p.id}
              href={`/roster/players/${p.id}`}
              className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-2.5 transition-colors hover:border-violet-600"
            >
              <PlayerAvatar photo={p.photo} nickname={p.nickname} color={accent} size={64} className="rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-neutral-100">{p.nickname}</span>
                  {p.isCaptain && <span className="text-xs text-violet-400">(C)</span>}
                  {countryCode(p.country) && (
                    <span className="rounded bg-neutral-800 px-1 text-[10px] text-neutral-400">
                      {countryCode(p.country)}
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-neutral-500">
                  {[roleLabel(p.role) ?? "роль не задана", p.mmr ? `${p.mmr.toLocaleString("ru")} MMR` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              {p.position && (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-neutral-900 text-xs text-neutral-400">
                  {p.position}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
