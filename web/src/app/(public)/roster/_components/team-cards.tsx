"use client";

import { useState } from "react";
import Link from "next/link";
import type { RosterMember, TeamWithRoster } from "@/lib/roster-data";
import { DIVISIONS } from "@/lib/divisions";
import { countryCode, teamAccent, teamTag } from "@/lib/profiles";
import { roleLabel } from "@/lib/roles";
import { PlayerAvatar, TeamLogo } from "./avatar";

// Карточка команды в списке: шапка с лого, разворачивается в состав. «Основа» и «Штаб» — вкладки,
// потому что замены и тренер в общем списке съедали внимание, хотя смотрят обычно на пятёрку.

/** Штаб — всё, что не позиция 1–5: замены и тренер. Правило то же, что и в расчёте MMR команды. */
const isCore = (p: RosterMember) => p.position !== null;

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
      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}

function PlayerRow({ player, accent }: { player: RosterMember; accent: string }) {
  const code = countryCode(player.country);

  return (
    <Link
      href={`/roster/players/${player.id}`}
      className="flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-neutral-900"
    >
      <PlayerAvatar photo={player.photo} nickname={player.nickname} color={accent} size={26} className="rounded-md" />
      <span className="w-6 shrink-0 text-[10px] font-medium text-neutral-600">{code ?? ""}</span>
      <span className="truncate text-sm text-neutral-200">{player.nickname}</span>
      {player.isCaptain && <span className="shrink-0 text-xs text-violet-400">(C)</span>}
      {/* пока добиваем ростер: точка вместо строки, чтобы не ломать ряд */}
      {!player.accountId && <span className="shrink-0 text-amber-400" title="нет account_id">•</span>}

      <span className="ml-auto shrink-0 text-xs text-neutral-500">
        {player.mmr ? player.mmr.toLocaleString("ru") : ""}
      </span>
      <span
        className="grid h-5 w-5 shrink-0 place-items-center rounded bg-neutral-900 text-[10px] text-neutral-400"
        title={roleLabel(player.role) ?? "роль не задана"}
      >
        {player.position ?? (player.role === "coach" ? "T" : "З")}
      </span>
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
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
      {/* полоска в цвет команды: единственный способ отличить карточки друг от друга с одного взгляда */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}00)` }} />

      <div className="flex items-center gap-3 p-3">
        <TeamLogo team={team} size={40} />
        <Link href={`/roster/teams/${team.id}`} className="group min-w-0 flex-1">
          <div className="truncate font-semibold text-neutral-100 group-hover:text-violet-300">{team.name}</div>
          <div className="truncate text-xs text-neutral-500">
            {/* свёрнутой карточке важнее размер состава, чем дивизион: он у всех одинаковый */}
            {(open ? [teamTag(team), team.group] : [teamTag(team), `${team.playersCount} игрок(ов)`])
              .filter(Boolean)
              .join(" · ")}
          </div>
        </Link>

        {team.mmrAverage !== null && (
          <span className="shrink-0 rounded bg-neutral-900 px-2 py-1 text-xs text-neutral-400">
            ср. <span className="font-medium text-neutral-200">{team.mmrAverage.toLocaleString("ru")}</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Свернуть состав" : "Развернуть состав"}
          className="grid h-7 w-7 shrink-0 place-items-center rounded border border-neutral-800 text-neutral-500 hover:border-violet-600 hover:text-violet-300"
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
        <>
          <div className="flex gap-1 border-t border-neutral-800/70 bg-neutral-900/30 p-1">
            <Tab active={tab === "main"} onClick={() => setTab("main")}>
              Основа
            </Tab>
            <Tab active={tab === "staff"} onClick={() => setTab("staff")}>
              Штаб{staff.length > 0 && <span className="ml-1 text-neutral-500">{staff.length}</span>}
            </Tab>
          </div>

          <div className="divide-y divide-neutral-900 pb-1">
            {shown.length === 0 ? (
              <p className="px-3 py-3 text-xs text-neutral-600">
                {tab === "main" ? "Основа не заведена." : "Ни замен, ни тренера."}
              </p>
            ) : (
              shown.map((p) => <PlayerRow key={p.id} player={p} accent={accent} />)
            )}
          </div>
        </>
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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {tabs.length > 1 ? (
          <div className="flex gap-1 rounded-lg bg-neutral-900/60 p-1">
            {tabs.map((t) => {
              const count = teams.filter((x) => (t.key === "—" ? !divisions.some((d) => d.name === x.group) : x.group === t.key)).length;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active === t.key ? "bg-violet-600/20 text-violet-200" : "text-neutral-500 hover:text-neutral-200"
                  }`}
                >
                  {t.label}
                  <span className="ml-1.5 text-xs text-neutral-500">{count}</span>
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
          className="shrink-0 text-xs text-neutral-500 hover:text-violet-300"
        >
          {collapsed ? "Развернуть все составы" : "Свернуть все составы"}
        </button>
      </div>

      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((t) => (
          <TeamCard key={`${t.id}-${generation}`} team={t} defaultOpen={!collapsed} />
        ))}
      </div>
    </div>
  );
}
