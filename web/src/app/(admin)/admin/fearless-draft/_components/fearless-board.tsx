"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  newFearless,
  currentStep,
  isSelectable,
  applyPick,
  undo,
  nextGame,
  canNextGame,
  isGameComplete,
  fearlessLocked,
  sideMoves,
  firstSideOf,
  type FearlessState,
  type Side,
} from "@/lib/fearless";

export type TeamRef = { id: number; name: string; color: string; logo: string | null };
export type HeroRef = { id: number; name: string; slug: string; img: string; attr: "str" | "agi" | "int" | "all" };

const ATTRS: { key: HeroRef["attr"] | "all-heroes"; label: string }[] = [
  { key: "all-heroes", label: "Все" },
  { key: "str", label: "Сила" },
  { key: "agi", label: "Ловкость" },
  { key: "int", label: "Интеллект" },
  { key: "all", label: "Универсал" },
];

const BEST_OF = [1, 2, 3, 5];

export function FearlessBoard({ teams, heroes }: { teams: TeamRef[]; heroes: HeroRef[] }) {
  const heroById = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const [state, setState] = useState<FearlessState | null>(null);

  if (!state) {
    return <Setup teams={teams} onStart={(s) => setState(s)} />;
  }

  const step = currentStep(state);
  const locked = fearlessLocked(state);
  const complete = isGameComplete(state);
  const activeTeam = step ? state.teams[step.side] : null;

  return (
    <div className="space-y-5">
      {/* Шапка серии: карта N, чей ход, управление */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface-1 p-4">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-widest text-ink-subtle">
            Карта {state.current + 1} / {state.bestOf} · Bo{state.bestOf}
          </span>
          {step ? (
            <span
              className="rounded-full px-3 py-1 text-sm font-semibold text-white"
              style={{ background: activeTeam!.color }}
            >
              {activeTeam!.name} — {step.action === "ban" ? "банит" : "пикает"}
            </span>
          ) : (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-400">
              Карта задрафчена
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setState(undo(state))} disabled={state.games[state.current].moves.length === 0}>
            ← Отменить
          </Button>
          {canNextGame(state) && (
            <Button type="button" size="sm" onClick={() => setState(nextGame(state))}>
              Следующая карта →
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" className="text-ink-subtle hover:text-rose-400" onClick={() => setState(null)}>
            Сбросить
          </Button>
        </div>
      </div>

      {/* Две колонки команд + грид героев между ними */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,15rem)]">
        <TeamColumn team={state.teams[0]} side={0} state={state} heroById={heroById} active={step?.side === 0} />

        <HeroGrid state={state} heroes={heroes} locked={locked} onPick={(id) => setState(applyPick(state, id))} disabled={!step} />

        <TeamColumn team={state.teams[1]} side={1} state={state} heroById={heroById} active={step?.side === 1} />
      </div>

      {complete && !canNextGame(state) && (
        <p className="text-center text-sm text-ink-subtle">
          Серия Bo{state.bestOf} задрафчена целиком. «Сбросить» — начать новую.
        </p>
      )}
    </div>
  );
}

/** Экран настройки: две команды и длина серии. */
function Setup({ teams, onStart }: { teams: TeamRef[]; onStart: (s: FearlessState) => void }) {
  const [aId, setAId] = useState<number | null>(teams[0]?.id ?? null);
  const [bId, setBId] = useState<number | null>(teams[1]?.id ?? null);
  const [bestOf, setBestOf] = useState(3);

  const a = teams.find((t) => t.id === aId);
  const b = teams.find((t) => t.id === bId);
  const ready = a && b && a.id !== b.id;

  const start = () => {
    if (!a || !b) return;
    onStart(newFearless([{ name: a.name, color: a.color }, { name: b.name, color: b.color }], bestOf));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fearless draft</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Драфт без повторов героев по серии: герой, взятый на прошлой карте, до конца серии недоступен. Баны — покарточные.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TeamPick label="Команда A (первый пик)" teams={teams} value={aId} onChange={setAId} exclude={bId} />
        <TeamPick label="Команда B" teams={teams} value={bId} onChange={setBId} exclude={aId} />
      </div>

      <div>
        <div className="mb-2 text-xs uppercase tracking-widest text-ink-subtle">Формат</div>
        <div className="flex gap-2">
          {BEST_OF.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setBestOf(n)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                bestOf === n ? "border-accent bg-accent/15 text-accent-bright" : "border-hairline bg-surface-1 text-ink-muted hover:border-accent/50"
              }`}
            >
              Bo{n}
            </button>
          ))}
        </div>
      </div>

      <Button type="button" disabled={!ready} onClick={start}>
        Начать драфт
      </Button>
      {!ready && <p className="text-xs text-ink-subtle">Выберите две разные команды.</p>}
    </div>
  );
}

function TeamPick({
  label,
  teams,
  value,
  onChange,
  exclude,
}: {
  label: string;
  teams: TeamRef[];
  value: number | null;
  onChange: (id: number) => void;
  exclude: number | null;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs uppercase tracking-widest text-ink-subtle">{label}</div>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-hairline bg-surface-1 px-3 py-2 text-sm text-ink"
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id} disabled={t.id === exclude}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Колонка команды: пять слотов пика и слоты банов текущей карты. */
function TeamColumn({
  team,
  side,
  state,
  heroById,
  active,
}: {
  team: { name: string; color: string };
  side: Side;
  state: FearlessState;
  heroById: Map<number, HeroRef>;
  active: boolean;
}) {
  const { picks, bans } = sideMoves(state, side);
  const first = firstSideOf(state.current) === side;

  return (
    <div
      className={`rounded-2xl border bg-surface-1 p-3 transition ${active ? "border-accent shadow-[0_0_0_1px_var(--color-accent)]" : "border-hairline"}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: team.color }} />
        <span className="truncate font-semibold text-ink">{team.name}</span>
        {first && <span className="ml-auto text-[10px] uppercase tracking-wide text-ink-subtle">первый пик</span>}
      </div>

      <div className="space-y-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <HeroSlot key={i} hero={picks[i] != null ? heroById.get(picks[i]) : undefined} />
        ))}
      </div>

      <div className="mt-3 border-t border-hairline pt-3">
        <div className="mb-1.5 text-[10px] uppercase tracking-widest text-ink-subtle">Баны карты</div>
        <div className="flex flex-wrap gap-1">
          {bans.length === 0 && <span className="text-xs text-ink-subtle">—</span>}
          {bans.map((id, i) => {
            const h = heroById.get(id);
            return h ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={h.img} alt={h.name} title={h.name} className="h-6 w-[38px] rounded object-cover opacity-50 grayscale" />
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}

function HeroSlot({ hero }: { hero: HeroRef | undefined }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-hairline bg-canvas/40 p-1.5">
      {hero ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero.img} alt={hero.name} className="h-8 w-[52px] shrink-0 rounded object-cover" />
          <span className="truncate text-xs font-medium text-ink">{hero.name}</span>
        </>
      ) : (
        <span className="py-2 text-xs text-ink-subtle">пусто</span>
      )}
    </div>
  );
}

/** Грид героев: фильтр по атрибуту и поиску; клик — применить текущий шаг. */
function HeroGrid({
  state,
  heroes,
  locked,
  onPick,
  disabled,
}: {
  state: FearlessState;
  heroes: HeroRef[];
  locked: Set<number>;
  onPick: (id: number) => void;
  disabled: boolean;
}) {
  const [q, setQ] = useState("");
  const [attr, setAttr] = useState<(typeof ATTRS)[number]["key"]>("all-heroes");

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return heroes.filter(
      (h) => (attr === "all-heroes" || h.attr === attr) && (query === "" || h.name.toLowerCase().includes(query)),
    );
  }, [heroes, q, attr]);

  return (
    <div className="rounded-2xl border border-hairline bg-surface-1 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск героя…" className="h-8 w-40" />
        <div className="flex flex-wrap gap-1">
          {ATTRS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAttr(a.key)}
              className={`rounded-full px-2.5 py-1 text-xs transition ${
                attr === a.key ? "bg-accent text-white" : "bg-surface-2 text-ink-muted hover:text-ink"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-ink-subtle">{shown.length} героев</span>
      </div>

      <div className="scroll-dark grid max-h-[62vh] grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-1.5 overflow-y-auto pr-1">
        {shown.map((h) => {
          const selectable = !disabled && isSelectable(state, h.id);
          const isLocked = locked.has(h.id);
          return (
            <button
              key={h.id}
              type="button"
              disabled={!selectable}
              onClick={() => onPick(h.id)}
              title={isLocked ? `${h.name} — уже взят в серии` : h.name}
              className={`group relative overflow-hidden rounded-md border transition ${
                selectable
                  ? "border-hairline hover:border-accent hover:ring-1 hover:ring-accent"
                  : "cursor-not-allowed border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={h.img}
                alt={h.name}
                className={`h-9 w-full object-cover transition ${selectable ? "" : "opacity-30 grayscale"}`}
              />
              {isLocked && (
                <span className="absolute inset-0 grid place-items-center bg-canvas/50 text-[9px] font-bold uppercase text-rose-300">
                  в серии
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-ink-subtle">
        Серые — забанены, взяты на карте или заблокированы серией (fearless). Клик — применить текущий ход.
      </p>
    </div>
  );
}
