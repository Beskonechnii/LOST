"use client";

import { useState, type ReactNode } from "react";

type PlayerReport = {
  side: "radiant" | "dire";
  name: string;
  hero: string;
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
  items: string[];
  backpack: string[];
  neutral: string | null;
  abilityOrder: string[];
  purchases: { name: string; time: number }[];
  buffs: { name: string; stacks: number }[];
};
type PickBan = { order: number; isPick: boolean; side: "radiant" | "dire"; hero: string };
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
const clock = (sec: number) => {
  const s = Math.abs(sec);
  return `${sec < 0 ? "-" : ""}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-neutral-500">{label}</div>
      <div className="text-neutral-200">{value}</div>
    </div>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone?: "amber" | "dim" }) {
  const cls =
    tone === "amber"
      ? "border-amber-700/50 text-amber-300"
      : tone === "dim"
        ? "border-neutral-800 text-neutral-500"
        : "border-neutral-700 text-neutral-300";
  return <span className={`rounded border px-1.5 py-0.5 text-[11px] ${cls}`}>{children}</span>;
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
            className={`rounded border px-1.5 py-0.5 text-[11px] ${
              pb.isPick ? "border-neutral-600" : "border-neutral-800 opacity-70"
            } ${pb.side === "radiant" ? "text-emerald-300" : "text-rose-300"}`}
          >
            <span className="text-neutral-500">{pb.order + 1}.</span> {pb.isPick ? "" : "бан "}
            {pb.hero}
          </span>
        ))}
      </div>
    </div>
  );
}

function PlayerCard({ p }: { p: PlayerReport }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 truncate">
          <span className="font-semibold text-neutral-100">{p.name}</span>
          <span className="ml-2 text-sm text-neutral-400">{p.hero}</span>
        </div>
        <span className="shrink-0 text-xs text-neutral-500">ур. {p.level}</span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
        <Stat label="K/D/A" value={`${p.kills}/${p.deaths}/${p.assists}`} />
        <Stat label="LH/DN" value={`${p.lastHits}/${p.denies}`} />
        <Stat label="GPM/XPM" value={`${p.gpm}/${p.xpm}`} />
        <Stat label="Ценность" value={fmt(p.netWorth)} />
        <Stat label="Урон·герои" value={fmt(p.heroDamage)} />
        <Stat label="Урон·строения" value={fmt(p.towerDamage)} />
        <Stat label="Хилл" value={fmt(p.heroHealing)} />
      </div>

      {(p.items.length > 0 || p.neutral || p.backpack.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {p.items.map((it, i) => (
            <Chip key={i}>{it}</Chip>
          ))}
          {p.neutral && <Chip tone="amber">{p.neutral}</Chip>}
          {p.backpack.map((it, i) => (
            <Chip key={`b${i}`} tone="dim">
              {it}
            </Chip>
          ))}
        </div>
      )}

      {p.buffs.length > 0 && (
        <div className="mt-2 text-xs text-neutral-400">
          Баффы: {p.buffs.map((b) => `${b.name}${b.stacks ? ` ×${b.stacks}` : ""}`).join(", ")}
        </div>
      )}

      {(p.abilityOrder.length > 0 || p.purchases.length > 0) && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-neutral-400 hover:text-neutral-200">Скиллы и покупки</summary>
          {p.abilityOrder.length > 0 && (
            <div className="mt-2">
              <div className="mb-1 text-neutral-500">Порядок способностей</div>
              <ol className="flex flex-wrap gap-1">
                {p.abilityOrder.map((a, i) => (
                  <li key={i} className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300">
                    <span className="text-neutral-500">{i + 1}.</span> {a}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {p.purchases.length > 0 && (
            <div className="mt-2">
              <div className="mb-1 text-neutral-500">Покупки (время)</div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-neutral-300">
                {p.purchases.map((q, i) => (
                  <span key={i}>
                    {q.name} <span className="text-neutral-500">{clock(q.time)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </details>
      )}
    </div>
  );
}

function TeamPanel({
  title,
  side,
  name,
  onName,
  won,
  score,
  aegis,
  players,
}: {
  title: string;
  side: "radiant" | "dire";
  name: string;
  onName: (v: string) => void;
  won: boolean;
  score: number;
  aegis: number;
  players: PlayerReport[];
}) {
  const accent = side === "radiant" ? "text-emerald-400" : "text-rose-400";
  return (
    <section className="flex-1">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-xs uppercase tracking-widest ${accent}`}>{title}</div>
          <input
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="Название команды"
            className="mt-1 w-full bg-transparent text-lg font-bold text-neutral-100 outline-none placeholder:text-neutral-600"
          />
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold tabular-nums text-neutral-100">{score}</div>
          <div className="text-xs text-neutral-500">аегисы: {aegis}</div>
        </div>
      </div>
      {won && (
        <div className="mb-2 inline-block rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
          ПОБЕДА
        </div>
      )}
      <div className="space-y-2">
        {players.map((p, i) => (
          <PlayerCard key={i} p={p} />
        ))}
      </div>
    </section>
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

  const radiant = match?.players.filter((p) => p.side === "radiant") ?? [];
  const dire = match?.players.filter((p) => p.side === "dire") ?? [];

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100 md:p-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">LOST — импорт матча</h1>
        <p className="mb-6 text-sm text-neutral-400">
          Вставь ID матча Dota 2 — полный отчёт подтянется из OpenDota. Команды называешь сам, цифры реальные.
        </p>

        <div className="mb-8 flex gap-2">
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Например, 8907510684"
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
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-400">
              <span>
                Матч <span className="text-neutral-200">{match.matchId}</span>
              </span>
              <span>время {clock(match.durationSeconds)}</span>
              <span>
                счёт <span className="text-emerald-400">{match.radiantScore}</span>:
                <span className="text-rose-400">{match.direScore}</span>
              </span>
              <span>
                победа —{" "}
                <span className={match.radiantWin ? "text-emerald-400" : "text-rose-400"}>
                  {match.radiantWin ? "Свет" : "Тьма"}
                </span>
              </span>
              {!match.parsed && <span className="text-amber-400">⚠ матч не распарсен — часть данных пуста</span>}
            </div>

            <Draft picksBans={match.picksBans} />
            <AdvantageChart gold={match.goldAdv} />

            <div className="flex flex-col gap-6 lg:flex-row">
              <TeamPanel
                title="Свет · Radiant"
                side="radiant"
                name={names.radiant}
                onName={(v) => setNames((s) => ({ ...s, radiant: v }))}
                won={match.radiantWin}
                score={match.radiantScore}
                aegis={match.aegis.radiant}
                players={radiant}
              />
              <TeamPanel
                title="Тьма · Dire"
                side="dire"
                name={names.dire}
                onName={(v) => setNames((s) => ({ ...s, dire: v }))}
                won={!match.radiantWin}
                score={match.direScore}
                aegis={match.aegis.dire}
                players={dire}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
