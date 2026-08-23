import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerProfile } from "@/lib/roster-data";
import { getPlayerHeroes } from "@/lib/player-stats";
import { getPlayerRecord, getTeammates } from "@/lib/player-record";
import { getPlayerLeague, mmss } from "@/lib/player-league";
import { ageOf, formatBirthday, playerGaps, playerLinks, teamAccent, telegramUrl, yearsLabel } from "@/lib/profiles";
import { heroImg } from "@/lib/assets";
import { rankLabel } from "@/lib/dota-rank";
import { roleLabel } from "@/lib/roles";
import { parseTags, tagLabel } from "@/lib/player-tags";
import { can } from "@/lib/account";
import { buttonClasses } from "@/components/pouf/Button";
import { Eyebrow } from "@/app/_components/ui";
import { PlayerAvatar, TeamLogo } from "../../_components/avatar";
import { PlayerMiniCard } from "../../_components/player-card";

export const dynamic = "force-dynamic";

/** Плашка факта: роль, MMR, возраст, город. Пустые значения не рисуем — дыр в строке быть не должно. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-pill bg-surface px-3 py-1 text-xs font-bold text-ink-muted cushion-field">
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
      className="rounded-[14px] bg-surface px-3 py-1.5 text-xs font-bold text-ink-muted cushion-field transition-colors hover:text-[var(--purple)]"
    >
      {children}
    </a>
  );
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pid = Number(id);
  const [player, authed, heroes, record, teammates, league] = await Promise.all([
    getPlayerProfile(pid),
    can("roster.edit"), // кнопка «Править» — ровно то право, что откроет саму страницу правки
    getPlayerHeroes(pid),
    getPlayerRecord(pid),
    getTeammates(pid),
    getPlayerLeague(pid),
  ]);
  if (!player) notFound();

  // главное место — первое по порядку ролей: оно и задаёт цвет страницы, и рисуется в крошках
  const main = player.spots[0] ?? null;
  const accent = main ? teamAccent(main.team) : "#a855f7";
  const links = playerLinks(player);
  const where = [player.city, player.country].filter(Boolean).join(", ");
  const gaps = playerGaps(player);
  const tags = parseTags(player.tags);
  // Достижения — свободный текст, одна строка = одна строчка списка; пустые строки отбрасываем.
  const achievements = (player.achievements ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-6 font-pouf">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-muted">
        <Link href="/roster/players" className="hover:text-[var(--purple)]">
          Игроки
        </Link>
        {main && (
          <>
            <span className="text-ink-subtle">/</span>
            <Link href={`/roster/teams/${main.team.id}`} className="hover:text-[var(--purple)]">
              {main.team.name}
            </Link>
          </>
        )}
        <span className="text-ink-subtle">/</span>
        <span className="text-ink-muted">{player.nickname}</span>
      </div>

      {/* Шапка: цвет команды задаёт настроение страницы, лого уходит в подложку водяным знаком */}
      <section className="relative overflow-hidden rounded-card bg-surface cushion-card">
        {/* Баннер профиля — самый нижний слой шапки, поверх него затемняющий градиент для читаемости */}
        {player.banner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.banner} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" />
        )}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: player.banner
              ? `linear-gradient(115deg, ${accent}55, transparent 45%), linear-gradient(0deg, var(--color-surface-1), transparent 70%)`
              : `linear-gradient(115deg, ${accent}2e, transparent 55%)`,
          }}
        />
        {!player.banner && main?.team.logo && (
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
              <h1 className="text-3xl font-black tracking-[-0.5px] text-ink">
                {player.orderNo != null && <span className="mr-2 align-middle text-xl font-black text-ink-subtle tabular-nums">#{player.orderNo}</span>}
                {player.nickname}
                {main?.isCaptain && <span className="ml-3 align-middle text-sm font-black text-[var(--purple)]">капитан</span>}
              </h1>
              {player.realName && <p className="font-bold text-ink-muted">{player.realName}</p>}
              {/* Плашки роли в лиге — кем человек является для лиги (игрок / кастер / организатор …) */}
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="rounded-pill bg-purple px-3 py-1 text-xs font-black text-[var(--on-accent)]">
                      {tagLabel(t)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {main && (
                <Link
                  href={`/roster/teams/${main.team.id}`}
                  className="flex items-center gap-2 rounded-pill bg-surface px-3 py-1 text-xs cushion-field transition-transform hover:-translate-y-px"
                >
                  <TeamLogo team={main.team} size={18} />
                  <span className="font-black text-ink">{main.team.name}</span>
                  {roleLabel(main.role) && <span className="font-bold text-muted">{roleLabel(main.role)}</span>}
                </Link>
              )}
              {player.mmr && <Chip>{player.mmr.toLocaleString("ru")} MMR</Chip>}
              {/* Ранг — из OpenDota при импорте состава, в отличие от MMR (его ставит оператор). */}
              {rankLabel(player.rank) && <Chip>{rankLabel(player.rank)}</Chip>}
              {player.tp > 0 && (
                <Link href="/tp" className="rounded-pill bg-purple px-3 py-1 text-xs font-black text-[var(--on-accent)] cushion-control transition-transform hover:-translate-y-px">
                  {player.tp} TP
                </Link>
              )}
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
              {player.interviewUrl && <ExternalLink href={player.interviewUrl}>Интервью</ExternalLink>}
              {!links.dotabuff && !player.telegram && (
                <span className="text-xs font-bold text-muted">Ссылок нет — заполните account_id или телеграм</span>
              )}
            </div>
          </div>

          {/* Правка и служебный slug — только оператору: посетителю ни то, ни другое не нужно */}
          {authed && (
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <Link href={`/admin/roster/players/${player.id}/edit`} className={buttonClasses({ size: "sm" })}>
                Редактировать
              </Link>
              <span className="text-xs font-bold text-muted">slug: {player.slug}</span>
            </div>
          )}
        </div>

        {gaps.length > 0 && (
          <div className="relative border-t border-hairline px-6 py-2 text-xs font-bold text-amber-400/90">
            Не заполнено: {gaps.join(", ")}
          </div>
        )}
      </section>

      {/* Все места в составах: у действующего игрока оно одно, у замены и тренера может быть несколько */}
      {player.spots.map((spot) => (
        <section key={spot.id}>
          <div className="mb-3 flex flex-wrap items-baseline gap-2">
            <Eyebrow>{spot === player.spots[0] ? "Команда" : "Ещё в составе"}</Eyebrow>
            <Link href={`/roster/teams/${spot.team.id}`} className="text-sm font-medium text-ink-muted hover:text-[var(--purple)]">
              {spot.team.name}
            </Link>
            <span className="text-xs text-ink-subtle">
              {/* Состав сезонный: подписываем место турниром и дивизионом, а не текущей группой команды */}
              {[
                roleLabel(spot.role) ?? "роль не задана",
                spot.division && `${spot.division.tournament.short ?? spot.division.tournament.name} · ${spot.division.short ?? spot.division.name}`,
              ]
                .filter(Boolean)
                .join(" · ")}
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

      {/* Статистика лиги — из привязанных к сериям карт (MatchStat). Есть игры → карьерка и герои,
          нет → мягкая заглушка со ссылкой на Dotabuff. */}
      <section>
        <Eyebrow className="mb-3">Статистика лиги</Eyebrow>
        {record.games === 0 ? (
          <div className="rounded-card bg-surface cushion-field p-6 text-center text-sm text-ink-subtle">
            Появится, когда в архив лягут карты этого игрока: винрейт, сигнатурные герои, тиммейты.
            {links.dotabuff && (
              <>
                {" "}
                Пока смотрите на{" "}
                <a href={links.dotabuff} target="_blank" rel="noreferrer" className="text-[var(--purple)] hover:underline">
                  Dotabuff
                </a>
                .
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Карьерка: сыграно, W-L, винрейт — и средние за карту (KDA, GPM/XPM, длительность). */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Карт", value: record.games, tone: "text-ink" },
                { label: "Победы — поражения", value: `${record.wins}–${record.losses}`, tone: "text-ink" },
                { label: "Винрейт", value: `${record.winrate.toFixed(0)}%`, tone: "text-[var(--purple)]" },
                { label: "Сред. KDA", value: `${league.summary.kills.toFixed(1)}/${league.summary.deaths.toFixed(1)}/${league.summary.assists.toFixed(1)}`, tone: "text-ink" },
                { label: "GPM / XPM", value: `${league.summary.gpm} / ${league.summary.xpm}`, tone: "text-ink" },
                { label: "Сред. время", value: mmss(league.summary.avgDurationSec) ?? "—", tone: "text-ink" },
              ].map((s) => (
                <div key={s.label} className="rounded-control bg-surface cushion-card p-4 text-center">
                  <div className={`text-xl font-black tabular-nums ${s.tone === "text-[var(--purple)]" ? "text-[var(--purple)]" : s.tone}`}>{s.value}</div>
                  <div className="mt-1 text-xs font-bold text-muted">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Разрез по турнирам: дивизион × стадия — карьерка и самый играемый герой. */}
            {league.tournaments.length > 0 && (
              <div>
                <div className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">По турнирам</div>
                <div className="overflow-hidden rounded-card cushion-card">
                  <table className="w-full text-sm">
                    <tbody>
                      {league.tournaments.map((t) => (
                        <tr key={`${t.division}-${t.stage}`} className="border-b border-hairline/60 last:border-0">
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-ink">{t.division}</div>
                            <div className="text-xs text-ink-subtle">{t.label}</div>
                          </td>
                          <td className="px-4 py-2.5 text-center tabular-nums text-ink-muted">{t.games} карт</td>
                          <td className="px-4 py-2.5 text-center tabular-nums">
                            <span className="text-emerald-400">{t.wins}</span>–<span className="text-rose-400">{t.losses}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center font-semibold tabular-nums text-[var(--purple)]">{t.winrate.toFixed(0)}%</td>
                          <td className="px-4 py-2.5">
                            {t.topHero && (
                              <div className="flex items-center justify-end gap-2 text-xs text-ink-muted">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={heroImg(t.topHero.slug)} alt={t.topHero.name} className="h-6 w-[38px] shrink-0 rounded object-cover" />
                                <span className="truncate">{t.topHero.name}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Последние карты: герой, K/D/A, GPM/XPM, за кого/против кого, стадия, ссылка на разбор. */}
            {league.games.length > 0 && (
              <div>
                <div className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">Последние игры</div>
                <div className="space-y-1.5">
                  {league.games.map((g) => (
                    <Link
                      key={g.matchId}
                      href={g.openDotaMatchId ? `/match/${g.openDotaMatchId}` : `/series/${g.seriesSlug}`}
                      className="flex items-center gap-3 rounded-control bg-surface cushion-field px-3 py-2 transition-colors hover:border-accent/60"
                    >
                      {/* Полоска исхода: зелёная — победа, красная — поражение */}
                      <span className={`h-9 w-1 shrink-0 rounded-full ${g.won ? "bg-emerald-400" : "bg-rose-400"}`} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={heroImg(g.heroSlug)} alt={g.heroName} className="h-9 w-[56px] shrink-0 rounded object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`font-semibold ${g.won ? "text-emerald-400" : "text-rose-400"}`}>{g.won ? "W" : "L"}</span>
                          {g.opponent && (
                            <span className="truncate text-ink-muted">
                              {g.myTeam && <span className="text-ink">{g.myTeam.tag ?? g.myTeam.name}</span>} vs {g.opponent.tag ?? g.opponent.name}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-ink-subtle">
                          {g.division} · {g.stageText}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs tabular-nums text-ink-muted">
                        <div className="text-ink">
                          <span className="text-emerald-400">{g.kills}</span>/<span className="text-rose-400">{g.deaths}</span>/<span className="text-sky-400">{g.assists}</span>
                        </div>
                        <div className="text-ink-subtle">
                          {g.gpm}/{g.xpm} gpm{mmss(g.durationSec) ? ` · ${mmss(g.durationSec)}` : ""}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Сигнатурные герои — топ по винрейту (мин. 2 карты). */}
            {heroes.signature.length > 0 && (
              <div>
                <div className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">Сигнатурные герои</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {heroes.signature.map((h) => (
                    <div key={h.slug} className="flex items-center gap-3 rounded-control bg-surface cushion-field p-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={heroImg(h.slug)} alt={h.name} className="h-10 w-[62px] shrink-0 rounded object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink">{h.name}</div>
                        <div className="text-xs text-ink-subtle tabular-nums">
                          {h.games} карт · <span className="text-emerald-400">{h.wins}</span>–<span className="text-rose-400">{h.losses}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold tabular-nums text-[var(--purple)]">{h.winrate.toFixed(0)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Самые играемые — топ по числу карт (герои уже отсортированы по играм). */}
            {heroes.heroes.length > 0 && (
              <div>
                <div className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">Самые играемые</div>
                <div className="flex flex-wrap gap-2">
                  {heroes.heroes.slice(0, 8).map((h) => (
                    <div key={h.slug} className="flex items-center gap-2 rounded-pill bg-surface py-1 pl-1 pr-3 cushion-field">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={heroImg(h.slug)} alt={h.name} className="h-6 w-[38px] shrink-0 rounded object-cover" />
                      <span className="text-xs font-medium text-ink">{h.name}</span>
                      <span className="text-xs tabular-nums text-ink-subtle">{h.games} · {h.winrate.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Достижения — свободный список из анкеты игрока. */}
      {achievements.length > 0 && (
        <section>
          <Eyebrow className="mb-3">Достижения</Eyebrow>
          <ul className="space-y-1.5">
            {achievements.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-muted">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Топ-5 тиммейтов — с кем больше всего сыграно за одну команду (турнирная стата, кликабельны). */}
      {teammates.length > 0 && (
        <section>
          <Eyebrow className="mb-3">Чаще всего играет с</Eyebrow>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {teammates.map((m) => (
              <PlayerMiniCard
                key={m.playerId}
                id={m.playerId}
                nickname={m.nickname}
                photo={m.photo}
                accent={m.accent}
                size={44}
                subtitle={
                  <div className="mt-1 text-xs tabular-nums text-ink-subtle">
                    {m.games} вместе · <span className="text-emerald-400">{m.wins}</span> побед
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
