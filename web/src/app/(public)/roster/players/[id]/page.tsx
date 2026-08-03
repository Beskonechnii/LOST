import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerProfile } from "@/lib/roster-data";
import { ageOf, formatBirthday, playerGaps, playerLinks, teamAccent, telegramUrl, yearsLabel } from "@/lib/profiles";
import { roleLabel } from "@/lib/roles";
import { isAdmin } from "@/lib/admin-session";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/app/_components/ui";
import { PlayerAvatar, TeamLogo } from "../../_components/avatar";
import { PlayerMiniCard } from "../../_components/player-card";

export const dynamic = "force-dynamic";

/** Плашка факта: роль, MMR, возраст, город. Пустые значения не рисуем — дыр в строке быть не должно. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-hairline-strong/70 bg-surface-1/60 px-3 py-1 text-xs text-ink-muted">
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
      className="rounded border border-hairline px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent hover:text-accent-bright"
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
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-subtle">
        <Link href="/roster/players" className="hover:text-ink-muted">
          Игроки
        </Link>
        {main && (
          <>
            <span className="text-ink-subtle">/</span>
            <Link href={`/roster/teams/${main.team.id}`} className="hover:text-ink-muted">
              {main.team.name}
            </Link>
          </>
        )}
        <span className="text-ink-subtle">/</span>
        <span className="text-ink-muted">{player.nickname}</span>
      </div>

      {/* Шапка: цвет команды задаёт настроение страницы, лого уходит в подложку водяным знаком */}
      <section className="relative overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-30px_rgba(0,0,0,0.95)]">
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
                {main?.isCaptain && <span className="ml-3 align-middle text-sm text-accent-bright">капитан</span>}
              </h1>
              {player.realName && <p className="text-ink-muted">{player.realName}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {main && (
                <Link
                  href={`/roster/teams/${main.team.id}`}
                  className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors hover:border-accent"
                  style={{ borderColor: `${accent}66` }}
                >
                  <TeamLogo team={main.team} size={18} />
                  <span className="font-medium text-ink">{main.team.name}</span>
                  {roleLabel(main.role) && <span className="text-ink-subtle">{roleLabel(main.role)}</span>}
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
                <span className="text-xs text-ink-subtle">Ссылок нет — заполните account_id или телеграм</span>
              )}
            </div>
          </div>

          {/* Правка и служебный slug — только оператору: посетителю ни то, ни другое не нужно */}
          {authed && (
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <Button asChild>
                <Link href={`/admin/roster/players/${player.id}/edit`}>Редактировать</Link>
              </Button>
              <span className="text-xs text-ink-subtle">slug: {player.slug}</span>
            </div>
          )}
        </div>

        {gaps.length > 0 && (
          <div className="relative border-t border-hairline px-6 py-2 text-xs text-amber-400/90">
            Не заполнено: {gaps.join(", ")}
          </div>
        )}
      </section>

      {/* Все места в составах: у действующего игрока оно одно, у замены и тренера может быть несколько */}
      {player.spots.map((spot) => (
        <section key={spot.id}>
          <div className="mb-3 flex flex-wrap items-baseline gap-2">
            <Eyebrow>{spot === player.spots[0] ? "Команда" : "Ещё в составе"}</Eyebrow>
            <Link href={`/roster/teams/${spot.team.id}`} className="text-sm font-medium text-ink-muted hover:text-accent-bright">
              {spot.team.name}
            </Link>
            <span className="text-xs text-ink-subtle">
              {[roleLabel(spot.role) ?? "роль не задана", spot.team.group].filter(Boolean).join(" · ")}
            </span>
          </div>

          {spot.teammates.length === 0 ? (
            <p className="text-sm text-ink-subtle">В составе больше никого нет.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {spot.teammates.map((m) => (
                <PlayerMiniCard
                  key={m.id}
                  id={m.id}
                  nickname={m.nickname}
                  photo={m.photo}
                  accent={teamAccent(spot.team)}
                  role={roleLabel(m.role)}
                  mmr={m.mmr}
                  isCaptain={m.isCaptain}
                  size={44}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      {/* Задел под статистику: модель MatchStat уже есть, матчей в базе пока нет */}
      <section>
        <Eyebrow className="mb-3">Статистика</Eyebrow>
        <div className="rounded-xl border border-dashed border-hairline p-6 text-center text-sm text-ink-subtle">
          Появится, когда в базу лягут матчи: средние K/D/A, любимые герои, MVP.
          {links.dotabuff && (
            <>
              {" "}
              Пока смотрите на{" "}
              <a href={links.dotabuff} target="_blank" rel="noreferrer" className="text-accent-bright hover:underline">
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
