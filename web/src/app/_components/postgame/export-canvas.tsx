"use client";

// Экспортный холст постгейма: раскладка 1 в 1 по референсу cyberscore —
// слева сводка матча (шапка, герои, баны, карта + график, события),
// справа две колонки карточек игроков. Всё в фиксированных пикселях (1280×460),
// PNG снимается с масштабом ×2 → 2560×920. Фон прозрачный: панели — полупрозрачные
// тёмные плашки, картинка накладывается на любую подложку в редакторе постов.

import { useRef, useState } from "react";
import { domToPng } from "modern-screenshot";
import { Canvas } from "@/studio/Canvas";
import { AdvantageChart, BuildingMap, EventBadges, HeroPortrait, Icon, ItemsRow, TeamCrest } from "./blocks";
import { clock, fmt, kFmt1, pad, type MatchReport, type PlayerReport, type Side } from "./types";

export const EXPORT_W = 1280;
export const EXPORT_H = 460;
export const EXPORT_SCALE = 2; // PNG выходит 2560×920

type Names = { radiant: string; dire: string };
type Logos = { radiant: string | null; dire: string | null };

const PANEL = "rounded-2xl bg-[#0c0c14]/90 ring-1 ring-white/10";

// --- Шапка: команда · бейджи | центр со счётом | команда (зеркально) ---
function HeaderTeam({
  name,
  logo,
  won,
  chips,
  align,
}: {
  name: string;
  logo: string | null;
  won: boolean;
  chips: React.ReactNode;
  align: "left" | "right";
}) {
  const crest = <TeamCrest logo={logo} name={name} size={36} />;
  const info = (
    <div className={`min-w-0 flex-1 ${align === "right" ? "text-right" : ""}`}>
      <div className="truncate text-[14px] font-bold text-neutral-100">{name || (align === "left" ? "Свет" : "Тьма")}</div>
      <div className={`mt-0.5 flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        <span
          className={`rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide ${
            won ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-400"
          }`}
        >
          {won ? "Победа" : "Поражение"}
        </span>
        {chips}
      </div>
    </div>
  );
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {align === "left" ? crest : info}
      {align === "left" ? info : crest}
    </div>
  );
}

function Header({ match, names, logos }: { match: MatchReport; names: Names; logos: Logos }) {
  const gold = match.goldAdv.at(-1) ?? 0;
  const xp = match.xpAdv.at(-1) ?? 0;
  const chip = (v: number, label: string, cls: string) => (
    <span key={label} className={`rounded px-1 py-px text-[8px] font-bold tabular-nums ring-1 ${cls}`}>
      +{kFmt1(Math.abs(v))} {label}
    </span>
  );
  const sideChips = (side: Side) => (
    <>
      {gold !== 0 && (side === "radiant") === gold > 0 && chip(gold, "золото", "bg-amber-500/15 text-amber-300 ring-amber-500/30")}
      {xp !== 0 && (side === "radiant") === xp > 0 && chip(xp, "опыт", "bg-sky-500/15 text-sky-300 ring-sky-500/30")}
    </>
  );
  const d = match.startTime ? new Date(match.startTime * 1000) : null;
  return (
    <div className="flex items-center gap-3">
      <HeaderTeam name={names.radiant} logo={logos.radiant} won={match.radiantWin} chips={sideChips("radiant")} align="left" />
      <div className="flex w-[150px] shrink-0 flex-col items-center">
        <div className="text-[8px] font-bold uppercase tracking-[0.25em] text-violet-300">League of Spirit</div>
        <div className="text-[26px] font-black leading-none tabular-nums">
          <span className="text-emerald-400">{match.radiantScore}</span>
          <span className="text-neutral-600"> – </span>
          <span className="text-rose-400">{match.direScore}</span>
        </div>
        <div className="mt-0.5 text-[8px] tabular-nums text-neutral-500">
          ⏱ {clock(match.durationSeconds)}{d ? ` · ${d.toLocaleDateString("ru-RU")}` : ""} · #{match.matchId}
        </div>
      </div>
      <HeaderTeam name={names.dire} logo={logos.dire} won={!match.radiantWin} chips={sideChips("dire")} align="right" />
    </div>
  );
}

// --- Полоса героев: 5+5 портретов с никами, плашки в тонах сторон ---
function Heroes({ radiant, dire }: { radiant: PlayerReport[]; dire: PlayerReport[] }) {
  const group = (list: PlayerReport[], side: Side) => (
    <div
      key={side}
      className={`grid flex-1 grid-cols-5 gap-1 rounded-lg p-1.5 ${side === "radiant" ? "bg-emerald-950/25" : "bg-rose-950/25"}`}
    >
      {pad(list, 5).map((p, i) =>
        p ? (
          <div key={i} className="flex min-w-0 flex-col items-center gap-0.5">
            <HeroPortrait hero={p.hero} />
            <span className="w-full truncate text-center text-[8px] font-semibold text-neutral-200">{p.name}</span>
          </div>
        ) : (
          <div key={i} className="aspect-video w-full rounded-md bg-neutral-800/40" />
        ),
      )}
    </div>
  );
  return (
    <div className="flex gap-2">
      {group(radiant, "radiant")}
      {group(dire, "dire")}
    </div>
  );
}

// --- Баны одной строкой: слева Свет, по центру подпись, справа Тьма ---
function Bans({ match }: { match: MatchReport }) {
  const bans = match.picksBans.filter((pb) => !pb.isPick);
  if (bans.length === 0) return null;
  const group = (side: Side) => (
    <div className={`flex items-center gap-0.5 ${side === "dire" ? "justify-end" : ""}`}>
      {bans
        .filter((b) => b.side === side)
        .map((b) => (
          <div key={b.order} className="relative">
            <Icon kind="heroes" slug={b.hero.slug} name={b.hero.name} h={15} className="opacity-60 grayscale" />
            <span className="pointer-events-none absolute inset-0 grid place-items-center text-[9px] font-black text-rose-500">✕</span>
          </div>
        ))}
    </div>
  );
  return (
    <div className="flex items-center justify-between gap-3">
      {group("radiant")}
      <span className="shrink-0 text-[8px] uppercase tracking-[0.25em] text-neutral-500">Баны</span>
      {group("dire")}
    </div>
  );
}

// --- Карточка игрока (правая панель): портрет+уровень+KDA, ник и цифры, NET-бар, предметы ---
function PlayerCard({ p, side, tag, maxNet }: { p: PlayerReport; side: Side; tag: string; maxNet: number }) {
  const tint = side === "radiant" ? "border-emerald-900/50 bg-emerald-950/20" : "border-rose-900/50 bg-rose-950/20";
  const box = (label: string, v: number) => (
    <span key={label} className="rounded bg-neutral-800/70 px-1 py-px text-[8px] tabular-nums text-neutral-200">
      <span className="text-neutral-500">{label} </span>
      <span className="font-bold">{v}</span>
    </span>
  );
  return (
    <div className={`flex min-h-0 flex-1 flex-col justify-between rounded-lg border p-1.5 ${tint}`}>
      <div className="flex gap-1.5">
        {/* портрет + уровень */}
        <div className="relative w-11 shrink-0 self-start">
          <HeroPortrait hero={p.hero} />
          <span className="absolute -bottom-1 -left-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-neutral-950 text-[8px] font-bold tabular-nums text-amber-300 ring-1 ring-amber-500/50">
            {p.level}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1">
            <span className={`shrink-0 text-[8px] font-black uppercase ${side === "radiant" ? "text-emerald-400" : "text-rose-400"}`}>
              {tag}
            </span>
            <span className="truncate text-[11px] font-semibold leading-tight text-neutral-100">{p.name}</span>
            {p.role && <span className="ml-auto shrink-0 text-[7px] uppercase tracking-wide text-neutral-500">{p.role}</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 leading-none">
            <span className="text-[9px] font-bold tabular-nums">
              <span className="text-emerald-400">{p.kills}</span>
              <span className="text-neutral-600">/</span>
              <span className="text-rose-400">{p.deaths}</span>
              <span className="text-neutral-600">/</span>
              <span className="text-sky-300">{p.assists}</span>
            </span>
            {box("XPM", p.xpm)}
            {box("GPM", p.gpm)}
          </div>
          {/* NET-бар относительно максимума в матче + урон и ЛХ/ДН справа */}
          <div className="mt-1 flex items-center gap-1.5">
            <div className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded bg-neutral-800/60">
              <div
                className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-amber-600 to-amber-400"
                style={{ width: `${Math.max(5, (p.netWorth / maxNet) * 100)}%` }}
              />
              <span
                className="absolute inset-0 grid place-items-center text-[8px] font-bold leading-none text-white"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,.8)" }}
              >
                {fmt(p.netWorth)}
              </span>
            </div>
            <span className="shrink-0 text-[8px] tabular-nums text-neutral-400">
              <span className="text-neutral-500">УРОН </span>
              {fmt(p.heroDamage)}
            </span>
            <span className="shrink-0 text-[8px] tabular-nums text-neutral-400">
              <span className="text-neutral-500">ЛХ/ДН </span>
              {p.lastHits}/{p.denies}
            </span>
          </div>
        </div>
      </div>
      <ItemsRow p={p} size={13} />
    </div>
  );
}

function TeamColumn({
  players,
  side,
  name,
  score,
  tag,
  maxNet,
}: {
  players: PlayerReport[];
  side: Side;
  name: string;
  score: number;
  tag: string;
  maxNet: number;
}) {
  const accent = side === "radiant" ? "text-emerald-400" : "text-rose-400";
  const bar = side === "radiant" ? "bg-emerald-500" : "bg-rose-500";
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex h-[18px] shrink-0 items-center gap-1.5">
        <span className={`h-3 w-1 rounded ${bar}`} />
        <span className={`truncate text-[11px] font-bold ${accent}`}>{name || (side === "radiant" ? "Свет" : "Тьма")}</span>
        <span className="ml-auto text-[13px] font-black leading-none tabular-nums text-neutral-100">{score}</span>
      </div>
      {players.slice(0, 5).map((p, i) => (
        <PlayerCard key={i} p={p} side={side} tag={tag} maxNet={maxNet} />
      ))}
    </div>
  );
}

// --- Сам холст ---
export function PostgameCanvas({
  match,
  names,
  tags,
  logos,
}: {
  match: MatchReport;
  names: Names;
  tags: Names;
  logos: Logos;
}) {
  const radiant = match.players.filter((p) => p.side === "radiant").slice().sort((a, b) => a.pos - b.pos);
  const dire = match.players.filter((p) => p.side === "dire").slice().sort((a, b) => a.pos - b.pos);
  const maxNet = Math.max(1, ...match.players.map((p) => p.netWorth));
  return (
    <div style={{ width: EXPORT_W, height: EXPORT_H }} className="flex gap-2 text-neutral-100">
      {/* левая панель — сводка матча */}
      <div className={`flex w-[632px] shrink-0 flex-col gap-2 p-3 ${PANEL}`}>
        <Header match={match} names={names} logos={logos} />
        <Heroes radiant={radiant} dire={dire} />
        <Bans match={match} />
        <div className="flex min-h-0 flex-1 gap-3">
          <div className="flex w-[205px] shrink-0 flex-col gap-1">
            <div className="w-full">
              <BuildingMap buildings={match.buildings} legend={false} />
            </div>
            {/* компактная легенда карты */}
            <div className="flex items-center justify-center gap-2 text-[7px] text-neutral-500">
              <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-sm bg-emerald-400" />Свет</span>
              <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-sm bg-rose-400" />Тьма</span>
              <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-sm bg-white" />уничтожено</span>
            </div>
            <EventBadges events={match.events} tags={tags} size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <AdvantageChart gold={match.goldAdv} xp={match.xpAdv} interactive={false} w={420} h={244} />
          </div>
        </div>
      </div>
      {/* правая панель — статистика игроков, Свет слева, Тьма справа */}
      <div className={`flex min-w-0 flex-1 gap-2 p-3 ${PANEL}`}>
        <TeamColumn players={radiant} side="radiant" name={names.radiant} score={match.radiantScore} tag={tags.radiant} maxNet={maxNet} />
        <TeamColumn players={dire} side="dire" name={names.dire} score={match.direScore} tag={tags.dire} maxNet={maxNet} />
      </div>
    </div>
  );
}

// --- Вкладка «Экспорт»: превью через студийный Canvas + скачивание PNG ×2 ---
export function PostgameExport(props: { match: MatchReport; names: Names; tags: Names; logos: Logos }) {
  const node = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function exportPng() {
    if (!node.current) return;
    setBusy(true);
    try {
      // масштаб превью снимаем на клоне; без явных width/height клон меряется по
      // ужатому bounding box превью и PNG выходит обрезанным. scale ×2 даёт ретину.
      const url = await domToPng(node.current, {
        width: EXPORT_W,
        height: EXPORT_H,
        scale: EXPORT_SCALE,
        style: { transform: "none" },
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `postgame-${props.match.matchId}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void exportPng()}
          className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {busy ? "Готовлю PNG…" : `Скачать PNG ${EXPORT_W * EXPORT_SCALE}×${EXPORT_H * EXPORT_SCALE}`}
        </button>
        <span className="text-xs text-neutral-500">
          Фон прозрачный — картинка ложится на любую подложку. Названия команд и лого правятся во вкладке «Отчёт».
        </span>
      </div>
      <div className="h-[52vh] min-h-[260px]">
        <Canvas w={EXPORT_W} h={EXPORT_H} nodeRef={node}>
          <PostgameCanvas {...props} />
        </Canvas>
      </div>
    </div>
  );
}
