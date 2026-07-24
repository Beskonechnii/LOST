"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
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
type Side = "radiant" | "dire";
type PickBan = { order: number; isPick: boolean; side: Side; hero: Entity };
type Lane = "top" | "mid" | "bot";
type SideBuildings = {
  towers: { lane: Lane; tier: 1 | 2 | 3; alive: boolean }[];
  ancient: { top: boolean; bottom: boolean };
  racks: { lane: Lane; ranged: boolean; melee: boolean }[];
};
type EventActor = { name: string; hero: Entity };
type MatchEvents = {
  firstBlood: { time: number; side: Side; killer: EventActor | null } | null;
  firstTower: { time: number; side: Side; killer: EventActor | null } | null;
  roshan: { radiant: number; dire: number; kills: { time: number; side: Side }[] };
  couriers: { radiant: number; dire: number; kills: { time: number; victimSide: Side; killer: Entity | null }[] };
};
type MatchReport = {
  matchId: string;
  parsed: boolean;
  radiantWin: boolean;
  durationSeconds: number;
  radiantScore: number;
  direScore: number;
  radiantTeam: string | null;
  direTeam: string | null;
  radiantTag: string | null;
  direTag: string | null;
  radiantLogo: string | null;
  direLogo: string | null;
  aegis: { radiant: number; dire: number };
  goldAdv: number[];
  xpAdv: number[];
  buildings: { radiant: SideBuildings; dire: SideBuildings };
  events: MatchEvents;
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

// Округление вверх до «красивого» шага для подписей оси (5к/10к/25к…).
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const steps = [1, 2, 2.5, 5, 10];
  for (const s of steps) if (v <= s * pow) return s * pow;
  return 10 * pow;
}

// Интерактивный график преимущества: золото (заливка + линия) и опыт (пунктир), общая шкала.
// Ось Y слева подписана значениями золота (верх — Свет, низ — Тьма), по X — тики времени.
// Наведение → вертикальный курсор с золотом/опытом на этой минуте.
function AdvantageChart({ gold, xp }: { gold: number[]; xp: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = gold.length;
  if (n < 2) return null;
  const hasXp = xp.length === n;
  const W = 660,
    H = 200,
    padL = 46,
    padR = 10,
    padT = 12,
    padB = 20;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const mid = padT + plotH / 2;
  const maxAbs = Math.max(1, ...gold.map(Math.abs), ...(hasXp ? xp.map(Math.abs) : []));
  const top = niceCeil(maxAbs);
  const x = (i: number) => padL + (i / (n - 1)) * plotW;
  const y = (v: number) => mid - (v / top) * (plotH / 2);
  const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const goldLine = path(gold);
  const area = `${goldLine} L${x(n - 1).toFixed(1)},${mid} L${padL},${mid} Z`;
  const last = gold[n - 1];
  const yTicks = [top, top / 2, 0, -top / 2, -top];
  const xStep = Math.max(1, Math.round((n - 1) / 6)); // ~6 подписей времени

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((svgX - padL) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400">
        <span>Преимущество по минутам</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-emerald-400" />золото
          </span>
          {hasXp && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-0 w-4 border-t border-dashed border-sky-400" />опыт
            </span>
          )}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="adv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0.35" />
            <stop offset="50%" stopColor="rgb(120 120 120)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="rgb(251 113 133)" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {/* сетка + подписи оси Y (золото) */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={padL}
              y1={y(v)}
              x2={W - padR}
              y2={y(v)}
              stroke={v === 0 ? "rgb(82 82 82)" : "rgb(38 38 38)"}
              strokeWidth={v === 0 ? 1 : 0.5}
              strokeDasharray={v === 0 ? "4 4" : undefined}
            />
            <text
              x={padL - 6}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-neutral-500"
              style={{ fontSize: 9 }}
            >
              {v === 0 ? "0" : `${v > 0 ? "+" : "−"}${kFmt(Math.abs(v))}`}
            </text>
          </g>
        ))}
        {/* тики времени по X */}
        {Array.from({ length: n }, (_, i) => i)
          .filter((i) => i % xStep === 0 || i === n - 1)
          .map((i) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-neutral-600" style={{ fontSize: 9 }}>
              {clock(i * 60)}
            </text>
          ))}
        <path d={area} fill="url(#adv)" />
        {hasXp && (
          <path d={path(xp)} fill="none" stroke="rgb(56 189 248)" strokeWidth="1.4" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        )}
        <path
          d={goldLine}
          fill="none"
          stroke={last >= 0 ? "rgb(52 211 153)" : "rgb(251 113 133)"}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {/* курсор наведения */}
        {hover != null && (
          <g>
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={H - padB} stroke="rgb(163 163 163)" strokeWidth="0.6" />
            <circle cx={x(hover)} cy={y(gold[hover])} r="2.6" fill={gold[hover] >= 0 ? "rgb(52 211 153)" : "rgb(251 113 133)"} />
            {hasXp && <circle cx={x(hover)} cy={y(xp[hover])} r="2.4" fill="rgb(56 189 248)" />}
            {/* тултип */}
            <g transform={`translate(${Math.min(x(hover) + 6, W - 128)}, ${padT + 4})`}>
              <rect width="122" height={hasXp ? 46 : 32} rx="4" fill="rgb(10 10 10)" stroke="rgb(64 64 64)" strokeWidth="0.5" />
              <text x="8" y="14" className="fill-neutral-300" style={{ fontSize: 9 }}>
                {`${hover} мин`}
              </text>
              <text x="8" y="27" style={{ fontSize: 9 }} className={gold[hover] >= 0 ? "fill-emerald-400" : "fill-rose-400"}>
                {`золото ${gold[hover] >= 0 ? "+" : "−"}${fmt(Math.abs(gold[hover]))}`}
              </text>
              {hasXp && (
                <text x="8" y="40" className="fill-sky-400" style={{ fontSize: 9 }}>
                  {`опыт ${xp[hover] >= 0 ? "+" : "−"}${fmt(Math.abs(xp[hover]))}`}
                </text>
              )}
            </g>
          </g>
        )}
      </svg>
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

// Герб команды: логотип из OpenDota, при отсутствии/ошибке — монограмма-заглушка.
function TeamCrest({ logo, name }: { logo: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (logo && !broken)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name}
        title={name}
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-11 w-11 shrink-0 rounded-lg object-contain ring-1 ring-neutral-700"
      />
    );
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-sm font-black text-white shadow">
      {initials(name)}
    </div>
  );
}

// --- Шапка со счётом (в духе broadcast-графики) ---
function TeamSide({
  name,
  onName,
  logo,
  score,
  won,
  align,
}: {
  name: string;
  onName: (v: string) => void;
  logo: string | null;
  score: number;
  won: boolean;
  align: "left" | "right";
}) {
  const mono = <TeamCrest logo={logo} name={name} />;
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
        logo={match.radiantLogo}
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
        logo={match.direLogo}
        score={match.direScore}
        won={!match.radiantWin}
        align="right"
      />
    </div>
  );
}

// Сводка итогового преимущества: последний отсчёт adv (>0 — ведёт Свет). Показываем сторону и разницу.
function AdvantageSummary({ match, names }: { match: MatchReport; names: { radiant: string; dire: string } }) {
  const gold = match.goldAdv.at(-1) ?? 0;
  const xp = match.xpAdv.at(-1) ?? 0;
  if (match.goldAdv.length === 0 && match.xpAdv.length === 0) return null;
  const leader = (v: number) =>
    v === 0
      ? { label: "равенство", cls: "text-neutral-400" }
      : v > 0
        ? { label: names.radiant || "Свет", cls: "text-emerald-400" }
        : { label: names.dire || "Тьма", cls: "text-rose-400" };
  const metric = (title: string, v: number, unit: string) => {
    const l = leader(v);
    return (
      <div key={title} className="flex flex-1 flex-col items-center gap-0.5 px-2 py-2">
        <div className="text-[10px] uppercase tracking-widest text-neutral-500">{title}</div>
        <div className={`text-lg font-black tabular-nums ${l.cls}`}>{v === 0 ? "—" : `+${kFmt(Math.abs(v))}`}</div>
        <div className={`truncate text-[11px] font-semibold ${l.cls}`} title={l.label}>
          {l.label}
          {v !== 0 && <span className="text-neutral-500"> · {unit}</span>}
        </div>
      </div>
    );
  };
  return (
    <div className="flex items-stretch divide-x divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900/60">
      {metric("Преимущество по золоту", gold, "золото")}
      {metric("Преимущество по опыту", xp, "опыт")}
    </div>
  );
}

// --- Баны под командами (в порядке очереди драфта) ---
function BansStrip({ picksBans, names }: { picksBans: PickBan[]; names: { radiant: string; dire: string } }) {
  const bans = picksBans.filter((pb) => !pb.isPick);
  if (bans.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      {(["radiant", "dire"] as const).map((side) => {
        const list = bans.filter((b) => b.side === side);
        const accent = side === "radiant" ? "text-emerald-400" : "text-rose-400";
        return (
          <div key={side} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className={`truncate text-xs font-bold uppercase tracking-wide ${accent}`}>
                {(side === "radiant" ? names.radiant : names.dire) || (side === "radiant" ? "Свет" : "Тьма")}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-neutral-500">Баны</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {list.length === 0 ? (
                <span className="text-xs text-neutral-600">—</span>
              ) : (
                list.map((b) => (
                  <div key={b.order} className="relative" title={`бан ${b.order + 1}: ${b.hero.name}`}>
                    <Icon kind="heroes" slug={b.hero.slug} name={b.hero.name} h={26} className="grayscale" />
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-sm bg-black/80 px-0.5 text-[8px] leading-tight tabular-nums text-neutral-300">
                      {b.order + 1}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Карта строений (схематичная миникарта; уничтоженные — белые) ---
// Координаты в системе 0..100 (x вправо, y вниз). Свет — низ-лево, Тьма — верх-право,
// река — диагональ. Тир 1 дальше от базы (ближе к центру), тир 3 у базы.
const TOWER_XY: Record<Side, Record<Lane, Record<1 | 2 | 3, [number, number]>>> = {
  radiant: {
    top: { 1: [8, 22], 2: [8, 42], 3: [9, 60] },
    mid: { 1: [52, 50], 2: [40, 62], 3: [28, 72] },
    bot: { 1: [78, 92], 2: [54, 91], 3: [32, 86] },
  },
  dire: {
    top: { 1: [22, 8], 2: [46, 9], 3: [68, 14] },
    mid: { 1: [50, 50], 2: [60, 38], 3: [72, 28] },
    bot: { 1: [92, 78], 2: [91, 54], 3: [86, 40] },
  },
};
const RACK_XY: Record<Side, Record<Lane, [number, number]>> = {
  radiant: { top: [12, 64], mid: [25, 76], bot: [28, 82] },
  dire: { top: [72, 12], mid: [75, 24], bot: [88, 36] },
};
const ANCIENT_XY: Record<Side, { base: [number, number]; top: [number, number]; bottom: [number, number] }> = {
  radiant: { base: [16, 84], top: [12, 80], bottom: [20, 88] },
  dire: { base: [84, 16], top: [80, 12], bottom: [88, 20] },
};

function BuildingMap({ buildings }: { buildings: MatchReport["buildings"] }) {
  const color = (side: Side) => (side === "radiant" ? "#34d399" : "#fb7185");
  // Целое — цвет стороны, уничтоженное — белое (полое).
  const fill = (side: Side, alive: boolean) => (alive ? color(side) : "#ffffff");
  const stroke = (side: Side, alive: boolean) => (alive ? color(side) : "#a3a3a3");
  const sides: Side[] = ["radiant", "dire"];
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-neutral-400">Строения</span>
        <span className="flex items-center gap-3 text-[10px] text-neutral-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-emerald-400" />Свет
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-rose-400" />Тьма
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-white" />уничтожено
          </span>
        </span>
      </div>
      <svg viewBox="0 0 100 100" className="mx-auto block aspect-square w-full max-w-[340px]">
        {/* половины карты + река */}
        <polygon points="0,0 100,0 0,100" fill="rgba(52,211,153,0.06)" />
        <polygon points="100,0 100,100 0,100" fill="rgba(251,113,133,0.06)" />
        <line x1="0" y1="100" x2="100" y2="0" stroke="rgb(64 64 64)" strokeWidth="0.6" strokeDasharray="2 2" />
        {sides.map((side) => {
          const b = buildings[side];
          const anc = ANCIENT_XY[side];
          return (
            <g key={side}>
              {/* казармы: два кружка (дальний — ranged, ближний — melee) */}
              {b.racks.map((r) => {
                const [x, y] = RACK_XY[side][r.lane];
                return (
                  <g key={`${side}-rk-${r.lane}`}>
                    <circle cx={x - 1.4} cy={y} r="1.5" fill={fill(side, r.ranged)} stroke={stroke(side, r.ranged)} strokeWidth="0.4" />
                    <circle cx={x + 1.4} cy={y} r="1.5" fill={fill(side, r.melee)} stroke={stroke(side, r.melee)} strokeWidth="0.4" />
                  </g>
                );
              })}
              {/* вышки: квадратики */}
              {b.towers.map((t) => {
                const [x, y] = TOWER_XY[side][t.lane][t.tier];
                return (
                  <rect
                    key={`${side}-tw-${t.lane}-${t.tier}`}
                    x={x - 1.7}
                    y={y - 1.7}
                    width="3.4"
                    height="3.4"
                    rx="0.6"
                    fill={fill(side, t.alive)}
                    stroke={stroke(side, t.alive)}
                    strokeWidth="0.5"
                  >
                    <title>{`${side === "radiant" ? "Свет" : "Тьма"} · ${t.lane} T${t.tier}${t.alive ? "" : " (уничтожена)"}`}</title>
                  </rect>
                );
              })}
              {/* трон: две башни ромбом */}
              {(["top", "bottom"] as const).map((k) => {
                const [x, y] = anc[k];
                const alive = b.ancient[k];
                return (
                  <rect
                    key={`${side}-anc-${k}`}
                    x={x - 2}
                    y={y - 2}
                    width="4"
                    height="4"
                    transform={`rotate(45 ${x} ${y})`}
                    fill={fill(side, alive)}
                    stroke={stroke(side, alive)}
                    strokeWidth="0.5"
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --- Ключевые события: FB, первая вышка, рошан, курьеры ---
function KeyEvents({ events, names }: { events: MatchEvents; names: { radiant: string; dire: string } }) {
  const sideName = (s: Side) => (s === "radiant" ? names.radiant || "Свет" : names.dire || "Тьма");
  const sideCls = (s: Side) => (s === "radiant" ? "text-emerald-400" : "text-rose-400");
  const { firstBlood, firstTower, roshan, couriers } = events;
  const hasAny =
    firstBlood || firstTower || roshan.kills.length > 0 || couriers.kills.length > 0;
  if (!hasAny) return null;
  const card = (label: string, body: ReactNode) => (
    <div key={label} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-1.5 text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
      {body}
    </div>
  );
  const actor = (a: EventActor | null, side: Side) =>
    a ? (
      <span className="flex items-center gap-1.5">
        <Icon kind="heroes" slug={a.hero.slug} name={a.hero.name} h={22} />
        <span className={`text-sm font-semibold ${sideCls(side)}`}>{a.name}</span>
      </span>
    ) : (
      <span className={`text-sm font-semibold ${sideCls(side)}`}>{sideName(side)}</span>
    );
  const firstEvent = (e: { time: number; side: Side; killer: EventActor | null } | null) =>
    e ? (
      <div className="flex items-center justify-between gap-2">
        {actor(e.killer, e.side)}
        <span className="shrink-0 tabular-nums text-xs text-neutral-500">{clock(e.time)}</span>
      </div>
    ) : (
      <span className="text-sm text-neutral-600">—</span>
    );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {card("Первая кровь", firstEvent(firstBlood))}
      {card("Первая вышка", firstEvent(firstTower))}
      {card(
        "Рошан",
        roshan.kills.length === 0 ? (
          <span className="text-sm text-neutral-600">—</span>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-emerald-400">{roshan.radiant}</span>
              <span className="text-neutral-600">:</span>
              <span className="text-rose-400">{roshan.dire}</span>
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
              {roshan.kills.map((k, i) => (
                <span key={i} className={sideCls(k.side)}>
                  {clock(k.time)}
                </span>
              ))}
            </div>
          </div>
        ),
      )}
      {card(
        "Курьеры",
        couriers.kills.length === 0 ? (
          <span className="text-sm text-neutral-600">—</span>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-emerald-400">{couriers.radiant}</span>
              <span className="text-neutral-600">:</span>
              <span className="text-rose-400">{couriers.dire}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {couriers.kills.map((k, i) => {
                const killerSide: Side = k.victimSide === "radiant" ? "dire" : "radiant";
                return k.killer ? (
                  <span key={i} className="flex items-center" title={`${clock(k.time)} · убил курьера`}>
                    <Icon kind="heroes" slug={k.killer.slug} name={k.killer.name} h={18} />
                  </span>
                ) : (
                  <span key={i} className={`text-[11px] ${sideCls(killerSide)}`} title={clock(k.time)}>
                    {clock(k.time)}
                  </span>
                );
              })}
            </div>
          </div>
        ),
      )}
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
      {/* герой + уровень */}
      <div className="relative w-14">
        <HeroPortrait hero={p.hero} />
        <span
          className="absolute -bottom-1 -left-1 grid h-5 w-5 place-items-center rounded-full bg-neutral-950 text-[10px] font-bold tabular-nums text-amber-300 ring-1 ring-amber-500/50"
          title={`Уровень ${p.level}`}
        >
          {p.level}
        </span>
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

// --- Скорборд карточками (главный вид, в стиле панели «Statistics» cyberscore) ---
// Карточка героя в тоне команды: портрет+уровень, ник+роль, статы, предметы, дерево талантов.
function HeroCard({ p, side }: { p: PlayerReport; side: "radiant" | "dire" }) {
  const tint =
    side === "radiant"
      ? "border-emerald-900/40 bg-emerald-950/15 hover:bg-emerald-950/25"
      : "border-rose-900/40 bg-rose-950/15 hover:bg-rose-950/25";
  const stat = (label: string, value: string, cls = "text-neutral-100") => (
    <div key={label} className="flex flex-col leading-tight">
      <span className="text-[9px] uppercase tracking-wide text-neutral-500">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${cls}`}>{value}</span>
    </div>
  );
  return (
    <div className={`rounded-lg border p-2 transition-colors ${tint}`}>
      <div className="flex items-start gap-2">
        {/* портрет + уровень */}
        <div className="relative w-14 shrink-0">
          <HeroPortrait hero={p.hero} />
          <span
            className="absolute -bottom-1 -left-1 grid h-5 w-5 place-items-center rounded-full bg-neutral-950 text-[10px] font-bold tabular-nums text-amber-300 ring-1 ring-amber-500/50"
            title={`Уровень ${p.level}`}
          >
            {p.level}
          </span>
        </div>
        {/* ник + статы */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-neutral-100" title={p.name}>
              {p.name}
            </span>
            {p.role && <span className="shrink-0 text-[10px] uppercase tracking-wide text-neutral-500">{p.role}</span>}
          </div>
          <div className="mt-1 grid grid-cols-3 gap-x-2 gap-y-1 sm:grid-cols-6">
            {stat("KDA", `${p.kills}/${p.deaths}/${p.assists}`)}
            {stat("Ценность", fmt(p.netWorth), "text-amber-300")}
            {stat("GPM", String(p.gpm))}
            {stat("XPM", String(p.xpm))}
            {stat("ЛХ/ДН", `${p.lastHits}/${p.denies}`)}
            {stat("Урон", kFmt(p.heroDamage))}
          </div>
        </div>
        {/* дерево талантов */}
        <div className="shrink-0 pl-1">
          <TalentTreeMini talents={p.talents} />
        </div>
      </div>
      {/* предметы */}
      <div className="mt-2 overflow-x-auto border-t border-neutral-800/60 pt-2">
        <ItemsRow p={p} />
      </div>
    </div>
  );
}

function CardTeam({
  side,
  fallback,
  teamName,
  logo,
  players,
  score,
  won,
}: {
  side: "radiant" | "dire";
  fallback: string;
  teamName: string;
  logo: string | null;
  players: PlayerReport[];
  score: number;
  won: boolean;
}) {
  const accent = side === "radiant" ? "text-emerald-400" : "text-rose-400";
  const bar = side === "radiant" ? "bg-emerald-500" : "bg-rose-500";
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-4 w-1 rounded ${bar}`} />
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={teamName} className="h-5 w-5 rounded object-contain" />
        )}
        <span className={`truncate text-sm font-bold ${accent}`}>{teamName || fallback}</span>
        {won && (
          <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Победа
          </span>
        )}
        <span className="ml-auto text-lg font-black tabular-nums text-neutral-100">{score}</span>
      </div>
      <div className="space-y-2">
        {players.map((p, i) => (
          <HeroCard key={i} p={p} side={side} />
        ))}
      </div>
    </div>
  );
}

function CardScoreboard({
  radiant,
  dire,
  names,
  logos,
  radiantScore,
  direScore,
  radiantWin,
}: {
  radiant: PlayerReport[];
  dire: PlayerReport[];
  names: { radiant: string; dire: string };
  logos: { radiant: string | null; dire: string | null };
  radiantScore: number;
  direScore: number;
  radiantWin: boolean;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <CardTeam side="radiant" fallback="Свет" teamName={names.radiant} logo={logos.radiant} players={radiant} score={radiantScore} won={radiantWin} />
      <CardTeam side="dire" fallback="Тьма" teamName={names.dire} logo={logos.dire} players={dire} score={direScore} won={!radiantWin} />
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
            <AdvantageSummary match={match} names={names} />
            <BansStrip picksBans={match.picksBans} names={names} />
            <KeyEvents events={match.events} names={names} />

            {/* карта строений + график преимущества */}
            <div className="grid gap-3 lg:grid-cols-3">
              <BuildingMap buildings={match.buildings} />
              {match.goldAdv.length >= 2 && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 lg:col-span-2">
                  <AdvantageChart gold={match.goldAdv} xp={match.xpAdv} />
                </div>
              )}
            </div>

            <CardScoreboard
              radiant={radiant}
              dire={dire}
              names={names}
              logos={{ radiant: match.radiantLogo, dire: match.direLogo }}
              radiantScore={match.radiantScore}
              direScore={match.direScore}
              radiantWin={match.radiantWin}
            />

            <details className="rounded-xl border border-neutral-800 bg-neutral-900/40">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-neutral-300 hover:text-neutral-100">
                Таблица (плотный вид)
              </summary>
              <div className="px-4 pb-4">
                <Scoreboard
                  radiant={radiant}
                  dire={dire}
                  names={names}
                  radiantScore={match.radiantScore}
                  direScore={match.direScore}
                  radiantWin={match.radiantWin}
                />
              </div>
            </details>

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
                Драфт (пики и баны по очереди)
              </summary>
              <div className="px-4 pb-4">
                <Draft picksBans={match.picksBans} names={names} />
              </div>
            </details>
          </div>
        )}
      </div>
    </main>
  );
}
