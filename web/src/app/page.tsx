"use client";

import { useState } from "react";
import Link from "next/link";
import { assetUrl, assetFallback, type AssetKind } from "@/lib/assets";

type Entity = { name: string; slug: string };
type TalentOpt = { name: string; picked: boolean };
type TalentTier = { heroLevel: number; left: TalentOpt | null; right: TalentOpt | null };
type PlayerReport = {
  side: "radiant" | "dire";
  pos: number;
  role: string;
  name: string;
  hero: Entity;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  gpm: number;
  xpm: number;
  netWorth: number;
  heroDamage: number;
  towerDamage: number;
  heroHealing: number;
  items: Entity[];
  backpack: Entity[];
  neutral: Entity | null;
  hasScepter: boolean;
  hasShard: boolean;
  talents: TalentTier[];
  abilityOrder: Entity[];
  purchases: { name: string; slug: string; time: number }[];
  buffs: { name: string; stacks: number }[];
};
type PickBan = { order: number; isPick: boolean; side: "radiant" | "dire"; hero: Entity };
type MatchReport = {
  matchId: string;
  parsed: boolean;
  radiantWin: boolean;
  durationSeconds: number;
  radiantScore: number;
  direScore: number;
  radiantTeam: string | null;
  direTeam: string | null;
  aegis: { radiant: number; dire: number };
  goldAdv: number[];
  xpAdv: number[];
  picksBans: PickBan[];
  players: PlayerReport[];
};

const fmt = (n: number) => n.toLocaleString("ru-RU");
const kFmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));
const clock = (sec: number) => {
  const s = Math.abs(sec);
  return `${sec < 0 ? "-" : ""}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const initials = (s: string) =>
  (s.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 3) || "?").toUpperCase();
const pad = <T,>(arr: T[], n: number): (T | null)[] => [...arr, ...Array(Math.max(0, n - arr.length)).fill(null)].slice(0, n);

// Строки статистики скорборда (лейбл по центру + значение на игрока).
const STAT_ROWS: { label: string; val: (p: PlayerReport) => string }[] = [
  { label: "KDA", val: (p) => `${p.kills}/${p.deaths}/${p.assists}` },
  { label: "УРОН", val: (p) => kFmt(p.heroDamage) },
  { label: "ЦЕННОСТЬ", val: (p) => fmt(p.netWorth) },
  { label: "ЛХ/ДН", val: (p) => `${p.lastHits}/${p.denies}` },
  { label: "GPM/XPM", val: (p) => `${p.gpm}/${p.xpm}` },
];

// Иконка ассета. src — локальный /assets/…; при 404 один раз пробуем CDN Valve, потом прячем.
function Icon({ kind, slug, name, h = 24, className = "" }: { kind: AssetKind; slug: string; name: string; h?: number; className?: string }) {
  if (!slug) return null;
  return (
    // крошечные иконки-спрайты + фолбэк на внешний CDN — next/image здесь избыточен
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={assetUrl(kind, slug)}
      alt={name}
      title={name}
      loading="lazy"
      style={{ height: h, width: "auto" }}
      onError={(e) => {
        const img = e.currentTarget;
        const fb = assetFallback(kind, slug);
        if (!img.src.endsWith(fb)) img.src = fb;
        else img.style.visibility = "hidden";
      }}
      className={`inline-block shrink-0 rounded-sm ring-1 ring-black/50 ${className}`}
    />
  );
}

// Портрет героя во всю ширину колонки (у скорборда своя раскладка, не Icon).
function HeroPortrait({ hero, dim }: { hero: Entity; dim?: boolean }) {
  if (!hero.slug) return <div className="aspect-video w-full rounded-md bg-neutral-800" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={assetUrl("heroes", hero.slug)}
      alt={hero.name}
      title={hero.name}
      loading="lazy"
      onError={(e) => {
        const img = e.currentTarget;
        const fb = assetFallback("heroes", hero.slug);
        if (!img.src.endsWith(fb)) img.src = fb;
        else img.style.opacity = "0";
      }}
      className={`block w-full rounded-md ring-1 ring-black/50 ${dim ? "opacity-60 grayscale" : ""}`}
    />
  );
}

function AdvantageChart({ gold }: { gold: number[] }) {
  if (gold.length < 2) return null;
  const W = 640;
  const H = 160;
  const pad = 8;
  const n = gold.length;
  const maxAbs = Math.max(1, ...gold.map((v) => Math.abs(v)));
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H / 2 - (v / maxAbs) * (H / 2 - pad);
  const line = gold.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H / 2} L0,${H / 2} Z`;
  const last = gold[n - 1];
  const peakR = Math.max(...gold);
  const peakD = Math.min(...gold);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-neutral-400">
        <span>Преимущество по золоту (по минутам)</span>
        <span>
          пик Свет <span className="text-emerald-400">+{fmt(Math.max(0, peakR))}</span> · пик Тьма{" "}
          <span className="text-rose-400">+{fmt(Math.max(0, -peakD))}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: 160 }}>
        <defs>
          <linearGradient id="adv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0.35" />
            <stop offset="50%" stopColor="rgb(120 120 120)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="rgb(251 113 133)" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="rgb(82 82 82)" strokeDasharray="4 4" strokeWidth="1" />
        <path d={area} fill="url(#adv)" />
        <path d={line} fill="none" stroke={last >= 0 ? "rgb(52 211 153)" : "rgb(251 113 133)"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
        <span>0:00</span>
        <span>{clock((n - 1) * 60)}</span>
      </div>
    </div>
  );
}

function Draft({ picksBans, names }: { picksBans: PickBan[]; names: { radiant: string; dire: string } }) {
  if (picksBans.length === 0) return null;
  const Row = ({ pb }: { pb: PickBan }) => (
    <div
      className={`flex items-center gap-1.5 rounded border py-0.5 pl-1 pr-1.5 text-[11px] ${
        pb.isPick ? "border-neutral-600" : "border-neutral-800 opacity-60"
      } ${pb.side === "radiant" ? "text-emerald-300" : "text-rose-300"}`}
    >
      <span className="w-4 shrink-0 text-right tabular-nums text-neutral-500">{pb.order + 1}.</span>
      <Icon kind="heroes" slug={pb.hero.slug} name={pb.hero.name} h={18} className={pb.isPick ? "" : "grayscale"} />
      <span className="truncate">
        {pb.isPick ? "" : "бан "}
        {pb.hero.name}
      </span>
    </div>
  );
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-widest text-neutral-400">Пики и баны (по очереди)</div>
      <div className="grid grid-cols-2 gap-4">
        {(["radiant", "dire"] as const).map((side) => (
          <div key={side}>
            <div
              className={`mb-2 truncate text-[11px] font-bold uppercase tracking-wide ${
                side === "radiant" ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {(side === "radiant" ? names.radiant : names.dire) || (side === "radiant" ? "Свет" : "Тьма")}
            </div>
            <div className="flex flex-col gap-1">
              {picksBans
                .filter((pb) => pb.side === side)
                .map((pb) => (
                  <Row key={pb.order} pb={pb} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Шапка со счётом (в духе broadcast-графики) ---
function TeamSide({
  name,
  onName,
  score,
  won,
  align,
}: {
  name: string;
  onName: (v: string) => void;
  score: number;
  won: boolean;
  align: "left" | "right";
}) {
  const mono = (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-sm font-black text-white shadow">
      {initials(name)}
    </div>
  );
  const nameBlock = (
    <div className={`min-w-0 flex-1 ${align === "right" ? "text-right" : ""}`}>
      <input
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder="Название команды"
        className={`w-full bg-transparent text-base font-bold text-neutral-100 outline-none placeholder:text-neutral-600 md:text-lg ${
          align === "right" ? "text-right" : ""
        }`}
      />
      {won && (
        <span className="mt-0.5 inline-block rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Победа
        </span>
      )}
    </div>
  );
  const scoreBlock = <div className="shrink-0 text-4xl font-black tabular-nums text-neutral-100">{score}</div>;
  return (
    <div className="flex flex-1 items-center gap-3">
      {align === "left" ? (
        <>
          {mono}
          {nameBlock}
          {scoreBlock}
        </>
      ) : (
        <>
          {scoreBlock}
          {nameBlock}
          {mono}
        </>
      )}
    </div>
  );
}

function ScoreHeader({
  match,
  names,
  setNames,
}: {
  match: MatchReport;
  names: { radiant: string; dire: string };
  setNames: (u: (s: { radiant: string; dire: string }) => { radiant: string; dire: string }) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 md:gap-5 md:p-4">
      <TeamSide
        name={names.radiant}
        onName={(v) => setNames((s) => ({ ...s, radiant: v }))}
        score={match.radiantScore}
        won={match.radiantWin}
        align="left"
      />
      <div className="flex shrink-0 flex-col items-center px-1">
        <div className="text-[10px] uppercase tracking-widest text-neutral-500">Длительность</div>
        <div className="text-xl font-bold tabular-nums text-neutral-100 md:text-2xl">{clock(match.durationSeconds)}</div>
        <div className="text-[10px] text-neutral-600">#{match.matchId}</div>
      </div>
      <TeamSide
        name={names.dire}
        onName={(v) => setNames((s) => ({ ...s, dire: v }))}
        score={match.direScore}
        won={!match.radiantWin}
        align="right"
      />
    </div>
  );
}

// --- Скорборд: по строке на игрока (команда → герой → остальное) ---

// Слот предмета фиксированного размера: иконка либо пустая ячейка (item-иконки ~4:3).
function ItemSlot({ item, h, className = "" }: { item: Entity | null; h: number; className?: string }) {
  if (!item || !item.slug)
    return (
      <div
        style={{ height: h, width: Math.round(h * 1.35) }}
        className="rounded-sm bg-neutral-800/50 ring-1 ring-inset ring-neutral-700/40"
      />
    );
  return <Icon kind="items" slug={item.slug} name={item.name} h={h} className={className} />;
}

// Инвентарь в одну строку: 6 базовых | 3 рюкзака | нейтрал | Аганим · Шард (секции разделены).
function ItemsRow({ p }: { p: PlayerReport }) {
  const base = pad(p.items, 6);
  const back = pad(p.backpack, 3);
  const neutral = p.neutral && p.neutral.slug ? p.neutral : null;
  const sep = "border-l border-neutral-700/60 pl-1.5";
  return (
    <div className="flex items-center gap-1.5">
      {/* 6 базовых */}
      <div className="flex gap-0.5">
        {base.map((it, i) => (
          <ItemSlot key={i} item={it} h={22} />
        ))}
      </div>
      {/* рюкзак (3) */}
      <div className={`flex gap-0.5 ${sep}`}>
        {back.map((it, i) => (
          <ItemSlot key={i} item={it} h={16} />
        ))}
      </div>
      {/* нейтральный предмет */}
      <div className={sep}>
        {neutral ? (
          <Icon kind="items" slug={neutral.slug} name={neutral.name} h={22} className="!rounded-full !ring-amber-500/70" />
        ) : (
          <div className="h-[22px] w-[22px] rounded-full bg-neutral-800/50 ring-1 ring-inset ring-amber-700/30" />
        )}
      </div>
      {/* Аганим (скипетр) + Шард — подсвечены при наличии */}
      <div className={`flex gap-1 ${sep}`}>
        <Icon
          kind="items"
          slug="ultimate_scepter"
          name="Аганим (скипетр)"
          h={16}
          className={p.hasScepter ? "!ring-fuchsia-500/70" : "opacity-20 grayscale"}
        />
        <Icon
          kind="items"
          slug="aghanims_shard"
          name="Аганим (шард)"
          h={16}
          className={p.hasShard ? "!ring-sky-500/70" : "opacity-20 grayscale"}
        />
      </div>
    </div>
  );
}

// Компактное дерево талантов для строки: 4 яруса (25→10), лево | уровень | право.
// Позиции лево/право — как в игре; выбранная сторона золотая. Полный текст — в подсказке.
function TalentTreeMini({ talents }: { talents: TalentTier[] }) {
  if (talents.length === 0) return <div className="text-center text-[10px] text-neutral-600">—</div>;
  const cell = (opt: TalentOpt | null, lvl: number, side: string) => (
    <span
      title={opt ? `${lvl} ур. (${side}): ${opt.name}` : undefined}
      className={`h-2.5 w-3 rounded-[2px] ${
        opt?.picked ? "bg-amber-400 ring-1 ring-amber-200/50" : "bg-neutral-700/50"
      }`}
    />
  );
  return (
    <div className="mx-auto flex w-fit flex-col gap-0.5">
      {talents.map((t) => (
        <div key={t.heroLevel} className="flex items-center gap-0.5">
          {cell(t.left, t.heroLevel, "лево")}
          <span className="w-3.5 text-center text-[8px] tabular-nums text-neutral-500">{t.heroLevel}</span>
          {cell(t.right, t.heroLevel, "право")}
        </div>
      ))}
    </div>
  );
}

// Раскладка колонок строки: герой | игрок | таланты | статы… | предметы. Общая для шапки и строк.
const SB_COLS = "3.5rem minmax(120px,1fr) 3.75rem 5rem 4rem 5.25rem 4.5rem 5.25rem auto";

function PlayerRow({ p }: { p: PlayerReport }) {
  return (
    <div
      className="grid items-center gap-x-2 border-t border-neutral-800/70 px-3 py-1.5 hover:bg-neutral-800/25"
      style={{ gridTemplateColumns: SB_COLS }}
    >
      {/* герой */}
      <div className="w-14">
        <HeroPortrait hero={p.hero} />
      </div>
      {/* игрок: ник + роль */}
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-neutral-100" title={p.name}>
          {p.name}
        </div>
        {p.role && <div className="text-[10px] uppercase tracking-wide text-neutral-400">{p.role}</div>}
      </div>
      {/* таланты */}
      <TalentTreeMini talents={p.talents} />
      {/* статы */}
      {STAT_ROWS.map((row) => (
        <div key={row.label} className="text-center text-sm font-semibold tabular-nums text-neutral-100">
          {row.val(p)}
        </div>
      ))}
      {/* предметы */}
      <ItemsRow p={p} />
    </div>
  );
}

function TeamTable({
  side,
  fallback,
  teamName,
  players,
  score,
  won,
}: {
  side: "radiant" | "dire";
  fallback: string;
  teamName: string;
  players: PlayerReport[];
  score: number;
  won: boolean;
}) {
  const rows = pad(players, 5);
  const accent = side === "radiant" ? "text-emerald-400" : "text-rose-400";
  const bar = side === "radiant" ? "bg-emerald-500" : "bg-rose-500";
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
      <div className="overflow-x-auto">
        <div className="min-w-[920px]">
          {/* шапка команды */}
          <div className="flex items-center gap-3 px-3 py-2">
            <span className={`h-4 w-1 rounded ${bar}`} />
            <span className={`text-sm font-bold ${accent}`}>{teamName || fallback}</span>
            {won && (
              <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Победа
              </span>
            )}
            <span className="ml-auto text-lg font-black tabular-nums text-neutral-100">{score}</span>
          </div>
          {/* заголовки колонок */}
          <div
            className="grid items-center gap-x-2 border-t border-neutral-800 px-3 py-1 text-[10px] uppercase tracking-wide text-neutral-500"
            style={{ gridTemplateColumns: SB_COLS }}
          >
            <div>Герой</div>
            <div>Игрок</div>
            <div className="text-center">Таланты</div>
            {STAT_ROWS.map((r) => (
              <div key={r.label} className="text-center">
                {r.label}
              </div>
            ))}
            <div>Предметы</div>
          </div>
          {/* строки игроков */}
          {rows.map((p, i) =>
            p ? (
              <PlayerRow key={i} p={p} />
            ) : (
              <div key={i} className="h-[52px] border-t border-neutral-800/70" />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function Scoreboard({
  radiant,
  dire,
  names,
  radiantScore,
  direScore,
  radiantWin,
}: {
  radiant: PlayerReport[];
  dire: PlayerReport[];
  names: { radiant: string; dire: string };
  radiantScore: number;
  direScore: number;
  radiantWin: boolean;
}) {
  return (
    <div className="space-y-3">
      <TeamTable side="radiant" fallback="Свет" teamName={names.radiant} players={radiant} score={radiantScore} won={radiantWin} />
      <TeamTable side="dire" fallback="Тьма" teamName={names.dire} players={dire} score={direScore} won={!radiantWin} />
    </div>
  );
}

// Полное дерево талантов в стиле игры: ярусы 25→10, слева/справа стороны,
// в центре золотой кружок уровня, выбранная сторона светится золотом.
function TalentTree({ talents }: { talents: TalentTier[] }) {
  if (talents.length === 0) return null;
  const Side = ({ opt, align }: { opt: TalentOpt | null; align: "left" | "right" }) => (
    <div
      title={opt?.name}
      className={`flex-1 self-stretch px-2 py-1 text-[11px] leading-tight ${align === "right" ? "text-right" : "text-left"} ${
        opt?.picked ? "bg-amber-500/10 font-semibold text-amber-200" : "text-neutral-400"
      }`}
    >
      {opt?.name ?? ""}
    </div>
  );
  return (
    <div className="mb-2">
      <div className="mb-1 text-neutral-500">Таланты</div>
      <div className="flex flex-col gap-1.5">
        {talents.map((t) => (
          <div
            key={t.heroLevel}
            className="flex items-center overflow-hidden rounded bg-gradient-to-r from-amber-500/5 via-black/30 to-amber-500/5 ring-1 ring-neutral-800"
          >
            <Side opt={t.left} align="right" />
            <div
              className="grid h-6 w-6 flex-none place-items-center rounded-full bg-neutral-950 text-[11px] font-bold tabular-nums text-amber-300 ring-1 ring-amber-500/40"
              style={{ boxShadow: "0 0 8px rgba(183,154,0,0.5)" }}
            >
              {t.heroLevel}
            </div>
            <Side opt={t.right} align="left" />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Доп. информация: скиллы и покупки (сворачиваемо) ---
function PlayerDetails({ p }: { p: PlayerReport }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900/40 p-3 text-xs">
      <div className="mb-2 flex items-center gap-2">
        <Icon kind="heroes" slug={p.hero.slug} name={p.hero.name} h={22} />
        <span className="font-semibold text-neutral-100">{p.name}</span>
        <span className="text-neutral-500">
          {p.role} · {p.hero.name}
        </span>
      </div>
      {p.buffs.length > 0 && (
        <div className="mb-2 text-neutral-400">
          Баффы: {p.buffs.map((b) => `${b.name}${b.stacks ? ` ×${b.stacks}` : ""}`).join(", ")}
        </div>
      )}
      <TalentTree talents={p.talents} />
      {p.abilityOrder.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-neutral-500">Порядок способностей</div>
          <ol className="flex flex-wrap gap-1">
            {p.abilityOrder.map((a, i) => (
              <li key={i} className="flex items-center gap-1 rounded bg-neutral-800/70 px-1 py-0.5">
                <span className="text-[10px] text-neutral-500">{i + 1}</span>
                <Icon kind="abilities" slug={a.slug} name={a.name} h={18} />
              </li>
            ))}
          </ol>
        </div>
      )}
      {p.purchases.length > 0 && (
        <div>
          <div className="mb-1 text-neutral-500">Покупки (время)</div>
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {p.purchases.map((q, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <Icon kind="items" slug={q.slug} name={q.name} h={18} />
                <span className="text-neutral-500">{clock(q.time)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchReport | null>(null);
  const [names, setNames] = useState({ radiant: "", dire: "" });

  async function load() {
    const clean = id.trim();
    if (!clean) return;
    setLoading(true);
    setError(null);
    setMatch(null);
    try {
      const res = await fetch(`/api/opendota/match/${clean}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка запроса");
      const m = json.match as MatchReport;
      setMatch(m);
      setNames({ radiant: m.radiantTeam ?? "", dire: m.direTeam ?? "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const radiant = (match?.players.filter((p) => p.side === "radiant") ?? []).slice().sort((a, b) => a.pos - b.pos);
  const dire = (match?.players.filter((p) => p.side === "dire") ?? []).slice().sort((a, b) => a.pos - b.pos);
  const byPos = [...radiant, ...dire];

  return (
    <main className="flex-1 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">LOST — импорт матча</h1>
            <p className="text-sm text-neutral-400">
              Вставь ID матча Dota 2 — постгейм-отчёт подтянется из OpenDota. Команды переименовываешь под LOST.
            </p>
          </div>
          {/* следующий шаг после разбора матча — графика по нему */}
          <div className="flex gap-2 text-sm">
            <Link
              href="/studio/new/match-day"
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-neutral-300 hover:border-violet-500 hover:text-white"
            >
              Итоги дня →
            </Link>
            <Link
              href="/studio/new/vs-announce"
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-neutral-300 hover:border-violet-500 hover:text-white"
            >
              Анонс матча →
            </Link>
          </div>
        </div>
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="ID матча Dota 2, напр. 8907510684"
            inputMode="numeric"
            className="w-full max-w-xs rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <button
            onClick={load}
            disabled={loading || !id.trim()}
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
          >
            {loading ? "Загрузка…" : "Получить"}
          </button>
        </div>

        {error && (
          <p className="rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">{error}</p>
        )}

        {match && (
          <div className="space-y-4">
            {/* заголовок в духе постгейма */}
            <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 font-black text-white">
                  L
                </div>
                <div className="text-[11px] uppercase tracking-widest text-neutral-400">League of Spirit</div>
              </div>
              <h1 className="text-xl font-black uppercase tracking-tight md:text-2xl">Postgame Stats</h1>
              <div className="text-[11px] text-amber-400">{match.parsed ? "" : "⚠ не распарсен"}</div>
            </div>

            <ScoreHeader match={match} names={names} setNames={setNames} />
            <Scoreboard
              radiant={radiant}
              dire={dire}
              names={names}
              radiantScore={match.radiantScore}
              direScore={match.direScore}
              radiantWin={match.radiantWin}
            />

            <details className="rounded-xl border border-neutral-800 bg-neutral-900/40">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-neutral-300 hover:text-neutral-100">
                Скиллы и покупки (по игрокам)
              </summary>
              <div className="grid gap-2 px-4 pb-4 md:grid-cols-2">
                {byPos.map((p, i) => (
                  <PlayerDetails key={i} p={p} />
                ))}
              </div>
            </details>

            <details className="rounded-xl border border-neutral-800 bg-neutral-900/40">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-neutral-300 hover:text-neutral-100">
                Драфт и график золота
              </summary>
              <div className="space-y-5 px-4 pb-4">
                <Draft picksBans={match.picksBans} names={names} />
                <AdvantageChart gold={match.goldAdv} />
              </div>
            </details>
          </div>
        )}
      </div>
    </main>
  );
}
