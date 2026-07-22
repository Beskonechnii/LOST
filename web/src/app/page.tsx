"use client";

import { useState } from "react";

type PlayerView = {
  side: "radiant" | "dire";
  name: string;
  hero: string;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  netWorth: number;
};
type MatchView = {
  matchId: string;
  radiantWin: boolean;
  radiantTeam: string | null;
  direTeam: string | null;
  players: PlayerView[];
};

function SideTable({
  title,
  side,
  name,
  onName,
  won,
  players,
}: {
  title: string;
  side: "radiant" | "dire";
  name: string;
  onName: (v: string) => void;
  won: boolean;
  players: PlayerView[];
}) {
  const accent = side === "radiant" ? "text-emerald-400" : "text-rose-400";
  return (
    <section className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className={`text-xs uppercase tracking-widest ${accent}`}>{title}</div>
          <input
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="Название команды"
            className="mt-1 w-full bg-transparent text-lg font-bold text-neutral-100 outline-none placeholder:text-neutral-600"
          />
        </div>
        {won && (
          <span className="shrink-0 rounded bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-400">
            ПОБЕДА
          </span>
        )}
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-left text-neutral-400">
            <th className="py-1.5 font-medium">Игрок</th>
            <th className="py-1.5 font-medium">Герой</th>
            <th className="py-1.5 text-center font-medium">Ур.</th>
            <th className="py-1.5 text-center font-medium">K/D/A</th>
            <th className="py-1.5 text-right font-medium">Ценность</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={i} className="border-b border-neutral-900">
              <td className="py-1.5 font-medium text-neutral-100">{p.name}</td>
              <td className="py-1.5 text-neutral-300">{p.hero}</td>
              <td className="py-1.5 text-center text-neutral-300">{p.level}</td>
              <td className="py-1.5 text-center text-neutral-300">
                {p.kills}/{p.deaths}/{p.assists}
              </td>
              <td className="py-1.5 text-right tabular-nums text-neutral-200">
                {p.netWorth.toLocaleString("ru-RU")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function Home() {
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchView | null>(null);
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
      setMatch(json.match as MatchView);
      setNames({ radiant: json.match.radiantTeam ?? "", dire: json.match.direTeam ?? "" });
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
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">LOST — импорт матча</h1>
        <p className="mb-6 text-sm text-neutral-400">
          Вставь ID матча Dota 2 — стата подтянется из OpenDota. Команды называешь сам, цифры реальные.
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
          <p className="rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}

        {match && (
          <>
            <div className="mb-4 text-sm text-neutral-400">
              Матч <span className="text-neutral-200">{match.matchId}</span> · победа —{" "}
              <span className={match.radiantWin ? "text-emerald-400" : "text-rose-400"}>
                {match.radiantWin ? "Свет (Radiant)" : "Тьма (Dire)"}
              </span>
            </div>
            <div className="flex flex-col gap-4 md:flex-row">
              <SideTable
                title="Свет · Radiant"
                side="radiant"
                name={names.radiant}
                onName={(v) => setNames((s) => ({ ...s, radiant: v }))}
                won={match.radiantWin}
                players={radiant}
              />
              <SideTable
                title="Тьма · Dire"
                side="dire"
                name={names.dire}
                onName={(v) => setNames((s) => ({ ...s, dire: v }))}
                won={!match.radiantWin}
                players={dire}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
