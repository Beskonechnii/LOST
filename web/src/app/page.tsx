"use client";

import { useState } from "react";
import { assetUrl, assetFallback, type AssetKind } from "@/lib/assets";

type Entity = { name: string; slug: string };
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
const padTo5 = <T,>(arr: T[]): (T | null)[] => [...arr, ...Array(Math.max(0, 5 - arr.length)).fill(null)].slice(0, 5);

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

function Draft({ picksBans }: { picksBans: PickBan[] }) {
  if (picksBans.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-widest text-neutral-400">Пики и баны (по очереди)</div>
      <div className="flex flex-wrap gap-1">
        {picksBans.map((pb) => (
          <span
            key={pb.order}
            className={`inline-flex items-center gap-1 rounded border py-0.5 pl-1 pr-1.5 text-[11px] ${
              pb.isPick ? "border-neutral-600" : "border-neutral-800 opacity-60"
            } ${pb.side === "radiant" ? "text-emerald-300" : "text-rose-300"}`}
          >
            <span className="text-neutral-500">{pb.order + 1}.</span>
            <Icon kind="heroes" slug={pb.hero.slug} name={pb.hero.name} h={18} className={pb.isPick ? "" : "grayscale"} />
            {pb.isPick ? "" : "бан "}
            {pb.hero.name}
          </span>
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

// --- Скорборд-матрица ---
function PlayerHead({ p }: { p: PlayerReport | null }) {
  if (!p) return <div />;
  return (
    <div className="text-center">
      {p.role && (
        <div className="mb-1 inline-block max-w-full truncate rounded bg-violet-600/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
          {p.role}
        </div>
      )}
      <div className="truncate text-xs font-semibold text-neutral-100" title={p.name}>
        {p.name}
      </div>
    </div>
  );
}

function ItemsCell({ p }: { p: PlayerReport | null }) {
  if (!p) return <div />;
  return (
    <div className="flex flex-wrap content-start justify-center gap-0.5">
      {p.items.map((it, i) => (
        <Icon key={i} kind="items" slug={it.slug} name={it.name} h={17} />
      ))}
      {p.neutral && <Icon kind="items" slug={p.neutral.slug} name={p.neutral.name} h={17} className="!ring-amber-600/70" />}
    </div>
  );
}

function Scoreboard({ radiant, dire }: { radiant: PlayerReport[]; dire: PlayerReport[] }) {
  const R = padTo5(radiant);
  const D = padTo5(dire);
  const cols = "repeat(5, minmax(0, 1fr)) auto repeat(5, minmax(0, 1fr))";
  const CenterPill = ({ label }: { label: string }) => (
    <div className="flex items-center justify-center">
      <span className="whitespace-nowrap rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-900">
        {label}
      </span>
    </div>
  );
  const values = (arr: (PlayerReport | null)[], val: (p: PlayerReport) => string) =>
    arr.map((p, i) => (
      <div key={i} className="text-center text-sm font-semibold tabular-nums text-neutral-100">
        {p ? val(p) : ""}
      </div>
    ));

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 md:p-4">
      <div className="grid min-w-[760px] items-center gap-x-1.5 gap-y-3" style={{ gridTemplateColumns: cols }}>
        {/* роли + ники */}
        {R.map((p, i) => (
          <PlayerHead key={`hr${i}`} p={p} />
        ))}
        <div />
        {D.map((p, i) => (
          <PlayerHead key={`hd${i}`} p={p} />
        ))}

        {/* портреты героев */}
        {R.map((p, i) => (
          <div key={`pr${i}`}>{p ? <HeroPortrait hero={p.hero} /> : null}</div>
        ))}
        <div className="mx-auto h-10 w-px bg-gradient-to-b from-transparent via-violet-500/50 to-transparent" />
        {D.map((p, i) => (
          <div key={`pd${i}`}>{p ? <HeroPortrait hero={p.hero} /> : null}</div>
        ))}

        {/* строки статистики */}
        {STAT_ROWS.map((row) => (
          <div key={row.label} className="contents">
            {values(R, row.val)}
            <CenterPill label={row.label} />
            {values(D, row.val)}
          </div>
        ))}

        {/* предметы */}
        {R.map((p, i) => (
          <ItemsCell key={`ir${i}`} p={p} />
        ))}
        <div />
        {D.map((p, i) => (
          <ItemsCell key={`id${i}`} p={p} />
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
    <main className="min-h-screen bg-neutral-950 p-4 text-neutral-100 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h1 className="text-lg font-bold tracking-tight">LOST — импорт матча</h1>
          <p className="text-sm text-neutral-400">
            Вставь ID матча Dota 2 — постгейм-отчёт подтянется из OpenDota. Команды переименовываешь под LOST.
          </p>
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
            <Scoreboard radiant={radiant} dire={dire} />

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
                <Draft picksBans={match.picksBans} />
                <AdvantageChart gold={match.goldAdv} />
              </div>
            </details>
          </div>
        )}
      </div>
    </main>
  );
}
