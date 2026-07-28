"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { PlayerAvatar } from "@/app/(public)/roster/_components/avatar";
import { ROLES } from "@/lib/roles";
import {
  addTeam,
  canLock,
  canSteal,
  currentTurn,
  draftBlocker,
  isTeamFull,
  memberIds,
  lockPlayer,
  patchTeam,
  pickPlayer,
  removeTeam,
  segmentPool,
  setCaptain,
  startDraft,
  stealPlayer,
  takenIds,
  teamById,
  type DraftState,
  type DraftTeam,
  type PoolPlayer,
} from "@/lib/draft";

// Борд шоу-драфта. Всё состояние — в DraftState (payload сессии): после каждого действия
// применяем чистый редьюсер из draft.ts и автосохраняем PATCH'ем. Правила гейтят кнопки
// (canPick/canLock/canSteal), редьюсеры на невалидном входе бросают — ошибку показываем строкой.

// Палитра для новых команд драфта — тёплые/контрастные тона, читаются на тёмной теме.
const PALETTE = ["#f59e0b", "#8b5cf6", "#ef4444", "#10b981", "#3b82f6", "#ec4899", "#14b8a6", "#f97316"];
const SHORT = new Map<string, string>(ROLES.map((r) => [r.key, r.short]));
const roleShort = (role: string | null) => (role ? SHORT.get(role) ?? role : "—");

export function DraftBoard({
  sessionId,
  initialTitle,
  initialState,
  pool,
}: {
  sessionId: number;
  initialTitle: string | null;
  initialState: DraftState;
  pool: PoolPlayer[];
}) {
  const [state, setState] = useState<DraftState>(initialState);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [saving, setSaving] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [dragPid, setDragPid] = useState<number | null>(null);

  const poolById = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);
  const segments = useMemo(() => segmentPool(pool), [pool]);
  const taken = useMemo(() => takenIds(state), [state]);
  const cur = currentTurn(state);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Автосейв через очередь: PATCH'и уходят строго по одному, и в полёте всегда только последнее
  // состояние. Иначе (fetch на каждое действие независимо) поздно прилетевший ранний запрос
  // перезаписал бы финал — на быстрых кликах драфт откатывался бы к более раннему состоянию.
  const pending = useRef<DraftState | null>(null);
  const flushing = useRef(false);
  const save = useCallback(
    (next: DraftState) => {
      pending.current = next;
      if (flushing.current) return; // уже сохраняем — новое состояние подхватит текущий цикл
      flushing.current = true;
      void (async () => {
        setSaving("saving");
        try {
          while (pending.current) {
            const body = pending.current;
            pending.current = null;
            const res = await fetch(`/api/underbeer/${sessionId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload: body }),
            });
            if (!res.ok) throw new Error(await res.text());
          }
          setSaving("idle");
        } catch {
          setSaving("error"); // сеть моргнула — состояние в UI цело, повторится следующим ходом
        } finally {
          flushing.current = false;
        }
      })();
    },
    [sessionId],
  );

  // применить редьюсер поверх актуального состояния; ошибку правила показать, а не уронить борд
  const run = useCallback(
    (fn: (s: DraftState) => DraftState) => {
      setState((s) => {
        try {
          setError(null);
          const next = fn(s);
          void save(next);
          return next;
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          return s;
        }
      });
    },
    [save],
  );

  const saveTitle = useCallback(
    (value: string) => {
      fetch(`/api/underbeer/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value }),
      }).catch(() => {});
    },
    [sessionId],
  );

  // активная команда конфига (кому назначаем капитана кликом) — выбранная или первая без капитана
  const activeTeam =
    (activeTeamId && teamById(state, activeTeamId)) || state.teams.find((t) => !t.captainId) || state.teams[0];

  // Клик по игроку пула: в конфиге — капитан активной команде, в драфте — пик текущей.
  function tapPlayer(pid: number) {
    if (taken.has(pid)) return;
    if (state.phase === "config") {
      if (!activeTeam) return setError("Сначала добавьте команду");
      run((s) => setCaptain(s, activeTeam.id, pid));
    } else if (state.phase === "draft") {
      run((s) => pickPlayer(s, pid));
    }
  }

  function onDragStart(e: DragStartEvent) {
    setDragPid(Number(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setDragPid(null);
    const pid = Number(e.active.id);
    const over = e.over?.id;
    if (typeof over !== "string" || !over.startsWith("team:")) return;
    const overTeamId = over.slice(5);

    if (state.phase === "config") {
      run((s) => setCaptain(s, overTeamId, pid)); // перетащили игрока в команду → её капитан
      return;
    }
    if (state.phase !== "draft") return;
    if (!cur || overTeamId !== cur.teamId) {
      setError("Сейчас ходит другая команда");
      return;
    }
    if (taken.has(pid)) {
      // перетащили чужого игрока из состава → кража
      const from = state.teams.find((t) => t.picks.includes(pid));
      if (from) run((s) => stealPlayer(s, from.id, pid));
    } else {
      run((s) => pickPlayer(s, pid));
    }
  }

  const dragPlayer = dragPid != null ? poolById.get(dragPid) : null;
  const blocker = draftBlocker(state);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {/* Шапка: название, статус сохранения, старт/оверлей */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => saveTitle(title)}
          placeholder={`Драфт #${sessionId}`}
          className="min-w-40 flex-1 rounded border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm outline-none focus:border-amber-600"
        />
        <span className="text-xs text-neutral-500">
          {saving === "saving" ? "Сохраняю…" : saving === "error" ? "Ошибка сохранения" : "Сохранено"}
        </span>
        <PhaseBadge phase={state.phase} />
        <Link
          href={`/overlay/underbeer/${sessionId}`}
          target="_blank"
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-amber-600"
        >
          Оверлей для OBS ↗
        </Link>
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {state.phase === "draft" && <TurnBanner state={state} />}

      <div className="mt-4 space-y-6">
        {/* ── Команды (сверху) ── */}
        <section className="space-y-4">
          {state.phase === "config" && (
            <ConfigControls
              state={state}
              activeTeamId={activeTeam?.id ?? null}
              blocker={blocker}
              onAddTeam={() =>
                run((s) => addTeam(s, `Команда ${s.teams.length + 1}`, PALETTE[s.teams.length % PALETTE.length]))
              }
              onTargetSize={(n) => run((s) => ({ ...s, targetSize: n }))}
              onSnake={(v) => run((s) => ({ ...s, snake: v }))}
              onStart={() => run((s) => startDraft(s))}
            />
          )}

          {state.phase === "done" && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-3 text-sm text-emerald-200">
              Составы собраны.
              <button
                onClick={() =>
                  run((s) => ({
                    ...s,
                    phase: "config",
                    turn: 0,
                    pendingPick: null,
                    teams: s.teams.map((t) => ({ ...t, picks: [], locked: [], usedLock: false, usedSteal: false })),
                  }))
                }
                className="rounded border border-emerald-800 px-2 py-1 text-xs hover:bg-emerald-900/40"
              >
                Пересобрать заново
              </button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {state.teams.map((team) => (
              <TeamColumn
                key={team.id}
                state={state}
                team={team}
                poolById={poolById}
                isCurrent={cur?.teamId === team.id}
                isActiveConfig={state.phase === "config" && activeTeam?.id === team.id}
                onSelectActive={() => setActiveTeamId(team.id)}
                onRemove={() => run((s) => removeTeam(s, team.id))}
                onRename={(name) => run((s) => patchTeam(s, team.id, { name }))}
                onLock={(pid) => run((s) => lockPlayer(s, team.id, pid))}
                onSteal={(fromId, pid) => run((s) => stealPlayer(s, fromId, pid))}
              />
            ))}
            {state.phase === "config" && state.teams.length === 0 && (
              <p className="text-sm text-neutral-600">Добавьте команды кнопкой выше.</p>
            )}
          </div>
        </section>

        {/* ── Пул игроков: каждая позиция — отдельная колонка ── */}
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">Пул игроков</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {segments.map((seg) => {
              const remaining = seg.players.filter((p) => !taken.has(p.id)).length;
              return (
                <div key={String(seg.position)} className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-2">
                  <div className="mb-1.5 flex items-center justify-between px-0.5 text-[11px] uppercase tracking-wide text-neutral-500">
                    <span className="truncate">{seg.label}</span>
                    <span className="shrink-0 text-neutral-600">{remaining}</span>
                  </div>
                  <div className="max-h-[56vh] space-y-1.5 overflow-y-auto pr-0.5">
                    {seg.players.map((p) => (
                      <PoolCard
                        key={p.id}
                        player={p}
                        taken={taken.has(p.id)}
                        draggable={state.phase === "config" ? !taken.has(p.id) : !taken.has(p.id) && !!cur}
                        onTap={() => tapPlayer(p.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <DragOverlay>
        {dragPlayer ? (
          <div className="w-64 rounded-md border border-amber-500 bg-neutral-900 opacity-95">
            <PlayerRow player={dragPlayer} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── Мелкие компоненты ──────────────────────────────────────────────────────────

function PhaseBadge({ phase }: { phase: DraftState["phase"] }) {
  const map = {
    config: ["Настройка", "bg-neutral-700/40 text-neutral-300"],
    draft: ["Идёт драфт", "bg-amber-500/15 text-amber-300"],
    done: ["Собран", "bg-emerald-500/15 text-emerald-300"],
  } as const;
  const [label, cls] = map[phase];
  return <span className={`rounded-full px-2.5 py-1 text-xs ${cls}`}>{label}</span>;
}

function TurnBanner({ state }: { state: DraftState }) {
  const cur = currentTurn(state);
  const team = cur ? teamById(state, cur.teamId) : undefined;
  if (!cur || !team) return null;
  return (
    <div
      className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
      style={{ borderColor: `${team.color}66`, background: `${team.color}14` }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: team.color }} />
      {cur.comp ? (
        <>
          <b>{team.name}</b> добирает игрока после кражи — вне очереди. Выберите одного из пула, и очередь
          продолжится.
        </>
      ) : (
        <>
          Ход команды <b>{team.name}</b>: перетащите игрока из пула в состав или кликните по нему.
          {team.usedSteal ? null : <span className="text-neutral-500">· «Украсть» ещё доступно</span>}
        </>
      )}
    </div>
  );
}

/** Строка игрока — общий вид для пула, оверлея и чипа состава. */
function PlayerRow({ player }: { player: PoolPlayer }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <PlayerAvatar photo={player.photo} nickname={player.nickname} color={player.teamColor} size={34} className="!rounded-md" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{player.nickname}</div>
        <div className="truncate text-[11px] text-neutral-500">
          {player.realName ? `${player.realName} · ` : ""}
          {roleShort(player.role)}
        </div>
      </div>
      <div className="shrink-0 text-right text-[11px] text-neutral-400">
        {player.mmr ? `${player.mmr.toLocaleString("ru-RU")}` : "—"}
        <div className="text-[10px] text-neutral-600">MMR</div>
      </div>
    </div>
  );
}

function PoolCard({
  player,
  taken,
  draggable,
  onTap,
}: {
  player: PoolPlayer;
  taken: boolean;
  draggable: boolean;
  onTap: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: player.id, disabled: !draggable });
  return (
    <div
      ref={setNodeRef}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      onClick={taken ? undefined : onTap}
      className={`rounded-md border bg-neutral-900/60 transition-colors ${
        taken
          ? "border-neutral-900 opacity-40"
          : `cursor-pointer border-neutral-800 hover:border-amber-600 ${draggable ? "active:cursor-grabbing" : ""}`
      } ${isDragging ? "opacity-30" : ""}`}
    >
      <PlayerRow player={player} />
    </div>
  );
}

function TeamColumn({
  state,
  team,
  poolById,
  isCurrent,
  isActiveConfig,
  onSelectActive,
  onRemove,
  onRename,
  onLock,
  onSteal,
}: {
  state: DraftState;
  team: DraftTeam;
  poolById: Map<number, PoolPlayer>;
  isCurrent: boolean;
  isActiveConfig: boolean;
  onSelectActive: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  onLock: (pid: number) => void;
  onSteal: (fromId: string, pid: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `team:${team.id}` });
  const full = isTeamFull(team, state.targetSize);
  const members = memberIds(team);
  const cur = currentTurn(state);
  const curTeamId = cur?.teamId ?? null;

  return (
    <div
      ref={setNodeRef}
      onClick={state.phase === "config" ? onSelectActive : undefined}
      className={`flex flex-col rounded-lg border bg-neutral-900/40 transition-colors ${
        isOver && isCurrent ? "border-amber-400" : isCurrent ? "border-amber-600" : "border-neutral-800"
      } ${isActiveConfig ? "ring-1 ring-amber-500" : ""} ${state.phase === "config" ? "cursor-pointer" : ""}`}
    >
      {/* Заголовок команды */}
      <div className="flex items-center gap-2 border-b border-neutral-800 p-2.5" style={{ borderTopColor: team.color }}>
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: team.color }} />
        {state.phase === "config" ? (
          <input
            value={team.name}
            onChange={(e) => onRename(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 rounded bg-transparent text-sm font-semibold outline-none focus:bg-neutral-950 focus:px-1"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{team.name}</span>
        )}
        <span className="shrink-0 text-xs text-neutral-500">
          {members.length}/{state.targetSize}
        </span>
        {state.phase === "config" && (
          <button onClick={(e) => (e.stopPropagation(), onRemove())} className="shrink-0 text-neutral-600 hover:text-red-400" title="Удалить команду">
            ✕
          </button>
        )}
      </div>

      {/* Значки использованных спец-действий */}
      {state.phase !== "config" && (
        <div className="flex gap-1.5 px-2.5 pt-2 text-[10px]">
          <span className={`rounded px-1.5 py-0.5 ${team.usedLock ? "bg-neutral-800 text-neutral-500 line-through" : "bg-sky-500/15 text-sky-300"}`}>
            Закрепить
          </span>
          <span className={`rounded px-1.5 py-0.5 ${team.usedSteal ? "bg-neutral-800 text-neutral-500 line-through" : "bg-fuchsia-500/15 text-fuchsia-300"}`}>
            Украсть
          </span>
        </div>
      )}

      {/* Состав */}
      <div className="flex-1 space-y-1 p-2">
        {members.length === 0 && <div className="px-1 py-3 text-center text-xs text-neutral-600">Нет игроков</div>}
        {members.map((pid) => {
          const p = poolById.get(pid);
          if (!p) return null;
          const isCaptain = team.captainId === pid;
          const locked = team.locked.includes(pid);
          const canLockThis = canLock(state, team.id, pid);
          // украсть можно, когда сейчас ходит ДРУГАЯ команда и правило разрешает
          const stealable = curTeamId != null && curTeamId !== team.id && canSteal(state, team.id, pid);
          return (
            <div key={pid} className="flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-950/50">
              <div className="min-w-0 flex-1">
                <PlayerRow player={p} />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5 pr-1.5">
                {isCaptain && <span className="rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-300">КАП</span>}
                {locked && <span title="Закреплён — украсть нельзя">🔒</span>}
                {canLockThis && (
                  <button onClick={() => onLock(pid)} className="rounded bg-sky-500/15 px-1 text-[9px] text-sky-300 hover:bg-sky-500/30">
                    Закрепить
                  </button>
                )}
                {stealable && (
                  <button
                    onClick={() => curTeamId && onSteal(team.id, pid)}
                    className="rounded bg-fuchsia-500/15 px-1 text-[9px] text-fuchsia-300 hover:bg-fuchsia-500/30"
                  >
                    Украсть
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!full && state.phase === "draft" && (
          <div className="rounded border border-dashed border-neutral-800 px-1 py-2 text-center text-[11px] text-neutral-600">
            {isCurrent ? "Перетащите сюда игрока" : "Ждёт своей очереди"}
          </div>
        )}
      </div>
    </div>
  );
}

/** Панель настройки: размер состава, змейка, добавление команд, старт. */
function ConfigControls({
  state,
  activeTeamId,
  blocker,
  onAddTeam,
  onTargetSize,
  onSnake,
  onStart,
}: {
  state: DraftState;
  activeTeamId: string | null;
  blocker: string | null;
  onAddTeam: () => void;
  onTargetSize: (n: number) => void;
  onSnake: (v: boolean) => void;
  onStart: () => void;
}) {
  const activeName = activeTeamId ? teamById(state, activeTeamId)?.name : null;
  return (
    <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          Размер состава
          <input
            type="number"
            min={2}
            max={5}
            value={state.targetSize}
            onChange={(e) => onTargetSize(Math.max(2, Math.min(5, Number(e.target.value) || 2)))}
            className="w-16 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={state.snake} onChange={(e) => onSnake(e.target.checked)} />
          Змейка (1→N, N→1)
        </label>
        <button onClick={onAddTeam} className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:border-amber-600">
          + Команда
        </button>
        <button
          onClick={onStart}
          disabled={!!blocker}
          title={blocker ?? "Начать драфт"}
          className="ml-auto rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-amber-500 disabled:opacity-40"
        >
          Начать драфт
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        {blocker
          ? blocker
          : `Кликните по команде, чтобы выбрать активную${
              activeName ? ` (сейчас «${activeName}»)` : ""
            }, затем по игроку — он станет капитаном. Или перетащите игрока прямо в команду.`}
      </p>
    </div>
  );
}
