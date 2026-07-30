"use client";

import { useState } from "react";
import Link from "next/link";
import type { RosterMember, TeamWithRoster } from "@/lib/roster-data";
import { DIVISIONS } from "@/lib/divisions";
import { countryCode, teamAccent, teamTag } from "@/lib/profiles";
import { roleLabel } from "@/lib/roles";
import { Chip, Meter } from "@/app/_components/ui";
import { PlayerAvatar } from "./avatar";

// Карточка команды в списке: шапка с лого, разворачивается в состав. «Основа» и «Штаб» — вкладки,
// потому что замены и тренер в общем списке съедали внимание, хотя смотрят обычно на пятёрку.
// Оформление — «полиш»: мягкая тень и свечение, цвет команды в рейке и плитке лого, у игрока —
// чип роли и мини-бар силы MMR.

/** Штаб — всё, что не позиция 1–5: замены и тренер. Правило то же, что и в расчёте MMR команды. */
const isCore = (p: RosterMember) => p.position !== null;

/** MMR → доля шкалы 2000…11000 для мини-бара. Пол в 6%, чтобы у слабых состав был виден. */
function mmrPct(mmr: number | null): number {
  if (!mmr) return 0;
  return Math.max(6, Math.min(100, Math.round(((mmr - 2000) / 9000) * 100)));
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
        active
          ? "bg-surface-3 text-ink shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]"
          : "text-ink-subtle hover:text-ink-muted"
      }`}
    >
      {children}
    </button>
  );
}

function PlayerRow({ player, accent }: { player: RosterMember; accent: string }) {
  const code = countryCode(player.country);
  const role = roleLabel(player.role);

  return (
    <Link
      href={`/roster/players/${player.id}`}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[linear-gradient(90deg,rgba(124,58,237,0.08),transparent)]"
    >
      <PlayerAvatar photo={player.photo} nickname={player.nickname} color={accent} size={30} className="rounded-[10px]" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-ink">{player.nickname}</span>
          {player.isCaptain && <span className="shrink-0 text-[11px] font-bold text-accent-bright">C</span>}
          {code && <span className="shrink-0 text-[10px] font-medium text-ink-subtle">{code}</span>}
          {/* пока добиваем ростер: точка вместо строки, чтобы не ломать ряд */}
          {!player.accountId && (
            <span className="shrink-0 text-amber-400" title="нет account_id">
              •
            </span>
          )}
        </div>
        {role && <Chip className="mt-1">{role}</Chip>}
      </div>

      <div className="shrink-0 text-right">
        <div className="text-sm font-bold tabular-nums text-ink">
          {player.mmr ? player.mmr.toLocaleString("ru") : "—"}
        </div>
        {player.mmr ? <Meter pct={mmrPct(player.mmr)} className="mt-1 ml-auto w-14" /> : null}
      </div>
    </Link>
  );
}

function TeamCard({ team, defaultOpen }: { team: TeamWithRoster; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<"main" | "staff">("main");

  const accent = teamAccent(team);
  const core = team.players.filter(isCore);
  const staff = team.players.filter((p) => !isCore(p));
  const shown = tab === "main" ? core : staff;

  return (
    <div
      style={{ "--tc": accent } as React.CSSProperties}
      className="group relative overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_14px_40px_-20px_rgba(0,0,0,0.9)] transition-transform duration-200 hover:-translate-y-0.5"
    >
      {/* рейка и верхнее свечение в цвет команды — карточки различимы с одного взгляда */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{ background: "linear-gradient(90deg, var(--tc), transparent 72%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--tc) 12%, transparent), transparent)" }}
      />

      <div className="relative flex items-center gap-3 p-4">
        {/* плитка лого: всегда цветная подложка команды, внутри лого или тег */}
        <div
          className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-xs font-bold text-white shadow-[0_8px_20px_-8px_var(--tc)]"
          style={{ background: "linear-gradient(145deg, var(--tc), color-mix(in srgb, var(--tc) 45%, #000))" }}
        >
          {team.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo} alt={team.name} className="h-full w-full object-contain p-1" />
          ) : (
            teamTag(team)
          )}
        </div>

        <Link href={`/roster/teams/${team.id}`} className="group/link min-w-0 flex-1">
          <div className="truncate font-bold tracking-tight text-ink group-hover/link:text-accent-bright">
            {team.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-subtle">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--tc)" }} />
            {(open ? [teamTag(team), team.group] : [teamTag(team), `${team.playersCount} игрок(ов)`])
              .filter(Boolean)
              .join(" · ")}
          </div>
        </Link>

        {team.mmrAverage !== null && (
          <div className="shrink-0 rounded-xl border border-accent/25 bg-accent/10 px-3 py-1.5 text-right">
            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-accent-bright">ср. MMR</div>
            <div className="text-base font-extrabold tabular-nums text-ink">{team.mmrAverage.toLocaleString("ru")}</div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Свернуть состав" : "Развернуть состав"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-hairline text-ink-subtle transition hover:border-accent hover:text-accent-bright"
        >
          <svg
            viewBox="0 0 16 16"
            className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="relative">
          <div className="flex gap-1.5 px-4 pb-3">
            <Tab active={tab === "main"} onClick={() => setTab("main")}>
              Основа
            </Tab>
            <Tab active={tab === "staff"} onClick={() => setTab("staff")}>
              Штаб{staff.length > 0 && <span className="ml-1 opacity-60">{staff.length}</span>}
            </Tab>
          </div>

          <div className="divide-y divide-hairline border-t border-hairline pb-1">
            {shown.length === 0 ? (
              <p className="px-4 py-4 text-xs text-ink-subtle">
                {tab === "main" ? "Основа не заведена." : "Ни замен, ни тренера."}
              </p>
            ) : (
              shown.map((p) => <PlayerRow key={p.id} player={p} accent={accent} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TeamCards({ teams }: { teams: TeamWithRoster[] }) {
  // Ключ по «свёрнутости всех» — самый дешёвый способ разом переоткрыть карточки:
  // меняем ключ, React пересоздаёт их с нужным начальным состоянием.
  const [generation, setGeneration] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  // Под-вкладки дивизионов: команды делим по Team.group, а общий пулл игроков остаётся единым
  // (страница /roster/players его не трогает). Показываем только те дивизионы, где есть команды,
  // в порядке справочника; безгрупповые (если появятся) сваливаем в отдельную вкладку «Прочие».
  const divisions = DIVISIONS.filter((d) => teams.some((t) => t.group === d.name));
  const hasOther = teams.some((t) => !divisions.some((d) => d.name === t.group));
  const tabs = [
    ...divisions.map((d) => ({ key: d.name, label: d.short })),
    ...(hasOther ? [{ key: "—", label: "Прочие" }] : []),
  ];
  const [tab, setTab] = useState(tabs[0]?.key ?? "—");
  const active = tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key ?? "—");
  const shown = teams.filter((t) => (active === "—" ? !divisions.some((d) => d.name === t.group) : t.group === active));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {tabs.length > 1 ? (
          <div className="flex gap-1.5">
            {tabs.map((t) => {
              const count = teams.filter((x) =>
                t.key === "—" ? !divisions.some((d) => d.name === x.group) : x.group === t.key,
              ).length;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                    active === t.key
                      ? "bg-gradient-to-b from-accent-bright to-accent text-white shadow-[0_6px_18px_-6px_rgba(124,58,237,0.7)]"
                      : "border border-hairline bg-surface-1 text-ink-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                  <span className={`ml-1.5 text-xs ${active === t.key ? "text-white/70" : "text-ink-subtle"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={() => {
            setCollapsed((v) => !v);
            setGeneration((g) => g + 1);
          }}
          className="shrink-0 text-xs font-medium text-ink-subtle transition-colors hover:text-accent-bright"
        >
          {collapsed ? "Развернуть все составы" : "Свернуть все составы"}
        </button>
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((t) => (
          <TeamCard key={`${t.id}-${generation}`} team={t} defaultOpen={!collapsed} />
        ))}
      </div>
    </div>
  );
}
