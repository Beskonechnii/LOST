import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerProfile } from "@/lib/roster-data";
import { ageOf, formatBirthday, playerGaps, playerLinks, teamAccent, telegramUrl, yearsLabel } from "@/lib/profiles";
import { roleLabel } from "@/lib/roles";
import { isAdmin } from "@/lib/admin-session";
import { PlayerAvatar, TeamLogo } from "../../_components/avatar";

export const dynamic = "force-dynamic";

/** Плашка факта: роль, MMR, возраст, город. Пустые значения не рисуем — дыр в строке быть не должно. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-700/70 bg-neutral-900/60 px-3 py-1 text-xs text-neutral-300">
      {children}
    </span>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-violet-600 hover:text-violet-300"
    >
      {children}
    </a>
  );
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [player, authed] = await Promise.all([getPlayerProfile(Number(id)), isAdmin()]);
  if (!player) notFound();

  // главное место — первое по порядку ролей: оно и задаёт цвет страницы, и рисуется в крошках
  const main = player.spots[0] ?? null;
  const accent = main ? teamAccent(main.team) : "#a855f7";
  const links = playerLinks(player);
  const where = [player.city, player.country].filter(Boolean).join(", ");
  const gaps = playerGaps(player);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
        <Link href="/roster/players" className="hover:text-neutral-300">
          Игроки
        </Link>
        {main && (
          <>
            <span className="text-neutral-700">/</span>
            <Link href={`/roster/teams/${main.team.id}`} className="hover:text-neutral-300">
              {main.team.name}
            </Link>
          </>
        )}
        <span className="text-neutral-700">/</span>
        <span className="text-neutral-400">{player.nickname}</span>
      </div>

      {/* Шапка: цвет команды задаёт настроение страницы, лого уходит в подложку водяным знаком */}
      <section className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `linear-gradient(115deg, ${accent}2e, transparent 55%)` }}
        />
        {main?.team.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={main.team.logo}
            alt=""
            className="pointer-events-none absolute -right-8 -top-10 hidden h-56 w-56 object-contain opacity-[0.08] sm:block"
          />
        )}

        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
          <PlayerAvatar photo={player.photo} nickname={player.nickname} color={accent} size={200} />

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {player.nickname}
                {main?.isCaptain && <span className="ml-3 align-middle text-sm text-violet-400">капитан</span>}
              </h1>
              {player.realName && <p className="text-neutral-400">{player.realName}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {main && (
                <Link
                  href={`/roster/teams/${main.team.id}`}
                  className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors hover:border-violet-600"
                  style={{ borderColor: `${accent}66` }}
                >
                  <TeamLogo team={main.team} size={18} />
                  <span className="font-medium text-neutral-200">{main.team.name}</span>
                  {roleLabel(main.role) && <span className="text-neutral-500">{roleLabel(main.role)}</span>}
                </Link>
              )}
              {player.mmr && <Chip>{player.mmr.toLocaleString("ru")} MMR</Chip>}
              {player.birthday && (
                <Chip>
                  {formatBirthday(player.birthday)} · {yearsLabel(ageOf(player.birthday))}
                </Chip>
              )}
              {where && <Chip>{where}</Chip>}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {player.telegram && <ExternalLink href={telegramUrl(player.telegram)}>@{player.telegram}</ExternalLink>}
              {links.dotabuff && <ExternalLink href={links.dotabuff}>Dotabuff</ExternalLink>}
              {links.stratz && <ExternalLink href={links.stratz}>Stratz</ExternalLink>}
              {links.steam && <ExternalLink href={links.steam}>Steam</ExternalLink>}
              {!links.dotabuff && !player.telegram && (
                <span className="text-xs text-neutral-600">Ссылок нет — заполните account_id или телеграм</span>
              )}
            </div>
          </div>

          {/* Правка и служебный slug — только оператору: посетителю ни то, ни другое не нужно */}
          {authed && (
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <Link
                href={`/admin/roster/players/${player.id}/edit`}
                className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
              >
                Редактировать
              </Link>
              <span className="text-xs text-neutral-600">slug: {player.slug}</span>
            </div>
          )}
        </div>

        {gaps.length > 0 && (
          <div className="relative border-t border-neutral-800/80 px-6 py-2 text-xs text-amber-400/90">
            Не заполнено: {gaps.join(", ")}
          </div>
        )}
      </section>

      {/* Все места в составах: у действующего игрока оно одно, у замены и тренера может быть несколько */}
      {player.spots.map((spot) => (
        <section key={spot.id}>
          <div className="mb-3 flex flex-wrap items-baseline gap-2">
            <h2 className="text-xs uppercase tracking-widest text-neutral-500">
              {spot === player.spots[0] ? "Команда" : "Ещё в составе"}
            </h2>
            <Link href={`/roster/teams/${spot.team.id}`} className="text-sm text-neutral-300 hover:text-violet-300">
              {spot.team.name}
            </Link>
            <span className="text-xs text-neutral-600">
              {[roleLabel(spot.role) ?? "роль не задана", spot.team.group].filter(Boolean).join(" · ")}
            </span>
          </div>

          {spot.teammates.length === 0 ? (
            <p className="text-sm text-neutral-500">В составе больше никого нет.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {spot.teammates.map((m) => (
                <Link
                  key={m.id}
                  href={`/roster/players/${m.id}`}
                  className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-2 hover:border-violet-600"
                >
                  <PlayerAvatar photo={m.photo} nickname={m.nickname} color={teamAccent(spot.team)} size={40} className="rounded-lg" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {m.nickname}
                      {m.isCaptain && <span className="ml-1.5 text-xs text-violet-400">(C)</span>}
                    </div>
                    <div className="truncate text-xs text-neutral-500">
                      {[roleLabel(m.role), m.mmr ? `${m.mmr.toLocaleString("ru")} MMR` : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      ))}

      {/* Задел под статистику: модель MatchStat уже есть, матчей в базе пока нет */}
      <section>
        <h2 className="mb-3 text-xs uppercase tracking-widest text-neutral-500">Статистика</h2>
        <div className="rounded-lg border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-600">
          Появится, когда в базу лягут матчи: средние K/D/A, любимые герои, MVP.
          {links.dotabuff && (
            <>
              {" "}
              Пока смотрите на{" "}
              <a href={links.dotabuff} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
                Dotabuff
              </a>
              .
            </>
          )}
        </div>
      </section>
    </div>
  );
}
