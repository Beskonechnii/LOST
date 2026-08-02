"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { SeriesRow } from "@/lib/series";
import { BRACKETS, STAGES, playoffLabel, stageLabel } from "@/lib/stages";
import { slotByKey, validScores } from "@/lib/playoff-bracket";
import { SectionHeader } from "@/app/_components/ui";

// Форма и список архива. Пишет через /api/series/* — тот же путь, что и у любой правки в проекте,
// поэтому серверных экшенов здесь нет: правило «не-GET к /api закрыт паролем» одно на всё.

type TeamOpt = { id: number; name: string; tag: string; division: string | null };
type DivOpt = { name: string; label: string };

/** Слот сетки для формы: подпись, команды (когда известны) и «занят ли». Считается на сервере. */
export type SlotOption = {
  key: string;
  label: string;
  round: string;
  bestOf: 3 | 5;
  aTeamId: number | null;
  bTeamId: number | null;
  aName: string;
  bName: string;
  taken: boolean;
};
export type SlotOptions = Record<string, SlotOption[]>;

const SCORES = ["2:0", "2:1", "1:2", "0:2"];

const clock = (sec: number | null) => (sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "—");

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-ink-subtle">{label}</span>
      {children}
    </label>
  );
}

const input =
  "rounded-lg border border-hairline bg-surface-2 px-2.5 py-1.5 text-sm outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/25";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-gradient-to-b from-accent-bright to-accent text-white shadow-[0_5px_14px_-6px_var(--color-accent)]"
          : "border border-hairline bg-surface-1 text-ink-muted hover:border-accent/60 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

// Кнопка-действие в строке архива: раньше это был голый текст-ссылка — на плотном списке читалось
// как мусор. Настоящая кнопка: бордер, фон на ховере, семантический цвет (правка/опасное/удаление).
function ActionBtn({
  onClick,
  disabled,
  tone = "neutral",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger" | "armed";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "border-hairline-strong text-ink-muted hover:border-accent-bright hover:bg-accent-bright/10 hover:text-accent-bright",
    danger: "border-hairline-strong text-ink-muted hover:border-rose-500 hover:bg-rose-500/10 hover:text-rose-300",
    armed: "border-rose-500 bg-rose-500/15 text-rose-300",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

/** Строка «привязать карту»: номер + id матча OpenDota. Стата читается сервером сразу при привязке. */
function AttachGame({ seriesId, nextNumber, onDone }: { seriesId: number; nextNumber: number; onDone: () => void }) {
  const [matchId, setMatchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/series/${seriesId}/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameNumber: nextNumber, openDotaMatchId: matchId.trim() }),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.ok) return setError(json.error ?? "Не вышло");
    setMatchId("");
    onDone();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-ink-subtle">карта {nextNumber}:</span>
      <input
        value={matchId}
        onChange={(e) => setMatchId(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && matchId.trim() && submit()}
        placeholder="ID матча OpenDota"
        className={`${input} w-44`}
      />
      <button
        onClick={submit}
        disabled={busy || !matchId.trim()}
        className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-contrast transition hover:bg-accent-bright disabled:opacity-40"
      >
        {busy ? "Читаю…" : "Привязать"}
      </button>
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}

function SeriesCard({ s, onChange }: { s: SeriesRow; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Подтверждение — вторым кликом по той же кнопке, а не системным confirm(): удаляется встреча
  // вместе с картами и статой, и цена промаха выше, чем неудобство второго клика.
  const [confirming, setConfirming] = useState(false);

  const resync = async (matchId: number) => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/series/${s.id}/games/${matchId}`, { method: "POST" });
    const json = await res.json().catch(() => ({ ok: res.ok }));
    setBusy(false);
    if (!json.ok) return setError(json.error ?? "Не вышло перечитать");
    onChange();
  };

  const detach = async (matchId: number) => {
    setBusy(true);
    const res = await fetch(`/api/series/${s.id}/games/${matchId}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({ ok: res.ok }));
    setBusy(false);
    if (!json.ok) return setError(json.error ?? "Не вышло отцепить");
    onChange();
  };

  const remove = async () => {
    if (!confirming) return setConfirming(true);
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/series/${s.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({ ok: res.ok }));
    setBusy(false);
    setConfirming(false);
    if (!json.ok) return setError(json.error ?? "Не вышло удалить");
    onChange();
  };

  const used = new Set(s.games.map((g) => g.gameNumber));
  const nextNumber = [1, 2, 3, 4, 5].find((n) => !used.has(n)) ?? 1;
  // В плей-офф показываем подпись слота («ЧФ-1»), а не общий раунд: иначе четыре четвертьфинала
  // в списке неотличимы. Слот знает свою половину сетки, поэтому даёт полную «Верхняя · ЧФ-1».
  const cut =
    s.stage === "group" ? `Группа ${s.group ?? "—"}` : playoffLabel(s.bracket, slotByKey(s.slot)?.label ?? s.round);

  return (
    <div
      className={`rounded-xl border border-hairline bg-surface-1 p-3.5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_12px_36px_-26px_rgba(0,0,0,0.9)] transition ${busy ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-ink-muted">
          {cut || stageLabel(s.stage)}
        </span>
        <Link href={`/series/${s.slug}`} className="text-sm font-medium hover:text-accent-bright hover:underline">
          {s.home.name}
          <span className="mx-2 font-bold tabular-nums text-ink">
            {s.homeScore}:{s.awayScore}
          </span>
          {s.away.name}
        </Link>
        {s.guessed && <span className="text-[10px] text-amber-400">счёт под вопросом</span>}
        {s.games.length > 0 && <span className="text-[10px] text-ink-subtle">карт: {s.games.length}</span>}

        <span className="ml-auto flex items-center gap-2">
          {confirming && (
            <ActionBtn tone="neutral" onClick={() => setConfirming(false)}>
              отмена
            </ActionBtn>
          )}
          <ActionBtn tone={confirming ? "armed" : "danger"} disabled={busy} onClick={remove}>
            {confirming ? "точно удалить?" : "удалить"}
          </ActionBtn>
        </span>
      </div>

      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}

      <div className="mt-2 space-y-1">
        {s.games.length === 0 && <p className="text-[11px] text-ink-subtle">Карт пока нет — стата в рейтинги не идёт.</p>}
        {s.games.map((g) => (
          <div key={g.matchId} className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span className="w-12 shrink-0 text-ink-subtle">карта {g.gameNumber ?? "?"}</span>
            {g.openDotaMatchId ?
              <Link href={`/match/${g.openDotaMatchId}`} className="text-accent-bright hover:underline">
                #{g.openDotaMatchId}
              </Link>
            : <span className="text-ink-subtle">без id</span>}
            <span className="tabular-nums text-ink-subtle">{clock(g.durationSec)}</span>
            <span className={g.statsCount ? "text-ink-subtle" : "text-amber-400"}>
              {g.statsCount ? `стата: ${g.statsCount} игроков` : "стата не легла — игроков нет в ростере"}
            </span>
            <span className="ml-auto flex items-center gap-2">
              {/* отчёт дозревает: непарсенный матч позже обрастает вардами и таймингами */}
              <ActionBtn tone="neutral" disabled={busy} onClick={() => resync(g.matchId)}>
                перечитать
              </ActionBtn>
              <ActionBtn tone="danger" disabled={busy} onClick={() => detach(g.matchId)}>
                отцепить
              </ActionBtn>
            </span>
          </div>
        ))}
        {s.games.length < 5 && <AttachGame seriesId={s.id} nextNumber={nextNumber} onDone={onChange} />}
      </div>
    </div>
  );
}

/** Порядок половин сетки для сортировки плей-оффа: верхняя → нижняя → гранд. */
const bracketOrder = (b: string | null) => BRACKETS.findIndex((x) => x.key === b);

export function SeriesAdmin({
  divisions,
  teams,
  series,
  slots,
}: {
  divisions: DivOpt[];
  teams: TeamOpt[];
  series: SeriesRow[];
  slots: SlotOptions;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  // Дивизион — верхняя вкладка (как в ростере команд): D1 и D2 играют раздельно, поэтому список
  // всегда показывает ровно один дивизион. Он же — дивизион по умолчанию в форме новой встречи.
  const [division, setDivision] = useState(divisions[0]?.name ?? "");
  const [stage, setStage] = useState<string>("group");
  const [group, setGroup] = useState("A");
  const [slot, setSlot] = useState("");
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [score, setScore] = useState(SCORES[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Слоты сетки выбранного дивизиона и выбранный слот; счёт ограничен его Bo (гранд-финал — Bo5).
  const divSlots = slots[division] ?? [];
  const selSlot = divSlots.find((s) => s.key === slot) ?? null;
  const scoreOptions = stage === "playoff" && selSlot ? validScores(selSlot.bestOf) : SCORES;

  // Выбор слота подставляет команды из сетки (когда исход предыдущего раунда уже известен) —
  // оператору остаётся только счёт. Счёт сбрасываем на первый допустимый для Bo слота.
  const pickSlot = (key: string) => {
    setSlot(key);
    const s = divSlots.find((x) => x.key === key);
    if (s) {
      if (s.aTeamId) setHomeId(String(s.aTeamId));
      if (s.bTeamId) setAwayId(String(s.bTeamId));
      setScore(validScores(s.bestOf)[0]);
    }
  };
  // Форма новой встречи держалась раскрытой всегда и занимала пол-экрана над списком, ради которого
  // сюда и приходят. Прячем её за кнопку и показываем модалкой по клику.
  const [showForm, setShowForm] = useState(false);

  // Команды показываем только своего дивизиона: D1 и D2 играют раздельно, перемешать их — ошибка.
  const options = teams.filter((t) => !t.division || t.division === division);

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        division,
        stage,
        group: stage === "group" ? group : null,
        slot: stage === "playoff" ? slot : null,
        homeId: Number(homeId),
        awayId: Number(awayId),
        score,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.ok) return setError(json.error ?? "Не вышло");
    setHomeId("");
    setAwayId("");
    setShowForm(false);
    refresh();
  };

  // Esc закрывает модалку — привычный жест, дешевле мыши до крестика.
  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowForm(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showForm]);

  // Встреч под сотню (вся групповая стадия двух дивизионов), поэтому список без разбивки
  // бесполезен: оператор приходит сюда за одной конкретной серией.
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "withGames" | "empty">("all");
  // Подраздел внутри дивизиона: группа A/B, плей-офф — или всё, что не легло в них («Прочее»).
  // Набор вкладок строится из данных, поэтому новая группа или стадия появляется в интерфейсе сама.
  const [sub, setSub] = useState<string>("g:A");

  const textMatch = (s: SeriesRow) => {
    if (only === "withGames" && s.games.length === 0) return false;
    if (only === "empty" && s.games.length > 0) return false;
    if (!q.trim()) return true;
    const text = `${s.home.name} ${s.away.name} ${s.home.tag} ${s.away.tag} ${s.round ?? ""}`.toLowerCase();
    return text.includes(q.trim().toLowerCase());
  };

  // Встречи активного дивизиона — база для вкладок подраздела и для списка.
  const inDivision = series.filter((s) => s.division === division);

  // Вкладки подраздела строим по факту: сколько групп есть — столько вкладок «Группа X»,
  // плюс «Плей-офф», плюс «Прочее» для всего, что не групповая стадия и не плей-офф.
  const isOther = (s: SeriesRow) => s.stage !== "group" && s.stage !== "playoff";
  const groups = [...new Set(inDivision.filter((s) => s.stage === "group").map((s) => s.group ?? "—"))].sort();
  const subTabs = [
    ...groups.map((g) => ({ key: `g:${g}`, label: `Группа ${g}`, test: (s: SeriesRow) => s.stage === "group" && (s.group ?? "—") === g })),
    ...(inDivision.some((s) => s.stage === "playoff") ? [{ key: "playoff", label: "Плей-офф", test: (s: SeriesRow) => s.stage === "playoff" }] : []),
    ...(inDivision.some(isOther) ? [{ key: "other", label: "Прочее", test: isOther }] : []),
  ];
  const activeSub = subTabs.find((t) => t.key === sub) ?? subTabs[0];

  // Список: встречи активного дивизиона и подраздела, прошедшие текст-фильтр. Плей-офф сортируем
  // по половине сетки (верхняя → нижняя → гранд), чтобы стадии шли в турнирном порядке.
  const rows = inDivision
    .filter((s) => (activeSub ? activeSub.test(s) : true) && textMatch(s))
    .sort((a, b) => (activeSub?.key === "playoff" ? bracketOrder(a.bracket) - bracketOrder(b.bracket) : 0));

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Служебная часть · архив"
        title="Архив серий"
        aside={
          <div className="flex flex-wrap items-center gap-4">
            <span className="hidden sm:inline">
              Карты отсюда идут в{" "}
              <Link href="/standings/d1/stats" className="text-accent-bright hover:underline">
                статистику
              </Link>
            </span>
            <button
              onClick={() => {
                setError(null);
                setShowForm(true);
              }}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-contrast shadow-[0_6px_18px_-6px_var(--color-accent)] transition hover:bg-accent-bright"
            >
              + Завести встречу
            </button>
          </div>
        }
      />

      {showForm && (
        // Модалка новой встречи: клик по фону закрывает, по самой плашке — нет (stopPropagation).
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowForm(false)}
        >
          <section
            className="mt-16 w-full max-w-3xl rounded-xl border border-hairline bg-surface-1 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Новая встреча</h2>
              <button
                onClick={() => setShowForm(false)}
                aria-label="Закрыть"
                className="rounded-md border border-hairline-strong px-2 py-0.5 text-sm text-ink-muted transition hover:border-hairline-strong hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
          <Field label="Дивизион">
            <select value={division} onChange={(e) => setDivision(e.target.value)} className={input}>
              {divisions.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Стадия">
            <select
              value={stage}
              onChange={(e) => {
                const v = e.target.value;
                setStage(v);
                // При переходе в плей-офф сразу берём первый свободный слот сетки — с командами.
                if (v === "playoff" && !slot) pickSlot((divSlots.find((s) => !s.taken) ?? divSlots[0])?.key ?? "");
              }}
              className={input}
            >
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          {stage === "group" ?
            <Field label="Группа">
              <select value={group} onChange={(e) => setGroup(e.target.value)} className={input}>
                {["A", "B"].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </Field>
          : <Field label="Слот сетки">
              {/* половину сетки и раунд не спрашиваем: их задаёт слот (см. src/lib/playoff-bracket.ts) */}
              <select value={slot} onChange={(e) => pickSlot(e.target.value)} className={`${input} w-56`}>
                {divSlots.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label} · {s.aName} — {s.bName}
                    {s.taken ? " (занят)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          }
          <Field label="Хозяева">
            <select value={homeId} onChange={(e) => setHomeId(e.target.value)} className={`${input} w-48`}>
              <option value="">—</option>
              {options.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Счёт">
            <select value={score} onChange={(e) => setScore(e.target.value)} className={input}>
              {scoreOptions.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Гости">
            <select value={awayId} onChange={(e) => setAwayId(e.target.value)} className={`${input} w-48`}>
              <option value="">—</option>
              {options.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
              <button
                onClick={create}
                disabled={busy || !homeId || !awayId || (stage === "playoff" && !slot)}
                className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-contrast shadow-[0_6px_18px_-6px_var(--color-accent)] transition hover:bg-accent-bright disabled:opacity-40"
              >
                {busy ? "…" : "Завести"}
              </button>
            </div>
            {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
          </section>
        </div>
      )}

      {/* Дивизион — крупные пилюли, как в ростере команд: наверху весь фильтр по разделам. */}
      <div className="flex flex-wrap items-center gap-2">
        {divisions.map((d) => {
          const count = series.filter((s) => s.division === d.name).length;
          const active = division === d.name;
          return (
            <button
              key={d.name}
              type="button"
              onClick={() => setDivision(d.name)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                active
                  ? "bg-gradient-to-b from-accent-bright to-accent text-white shadow-[0_6px_18px_-6px_rgba(124,58,237,0.7)]"
                  : "border border-hairline bg-surface-1 text-ink-muted hover:text-ink"
              }`}
            >
              {d.label}
              <span className={`ml-1.5 text-xs ${active ? "text-white/70" : "text-ink-subtle"}`}>{count}</span>
            </button>
          );
        })}

        {/* Поиск и фильтр по картам — на той же строке, справа: разрезы больше не занимают ряд. */}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по командам"
            className={`${input} w-52`}
          />
          {(
            [
              ["all", "Все"],
              ["withGames", "С картами"],
              ["empty", "Без карт"],
            ] as const
          ).map(([k, label]) => (
            <Chip key={k} active={only === k} onClick={() => setOnly(k)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Подраздел внутри дивизиона: группы и плей-офф. Счётчик — по дивизиону, без учёта текста. */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline pb-3">
        {subTabs.length === 0 ?
          <span className="text-xs text-ink-subtle">В дивизионе пока нет встреч.</span>
        : subTabs.map((t) => {
            const count = inDivision.filter(t.test).length;
            const active = activeSub?.key === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setSub(t.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? "bg-surface-3 text-ink shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]"
                    : "text-ink-subtle hover:text-ink-muted"
                }`}
              >
                {t.label}
                <span className={`ml-1.5 ${active ? "text-ink-muted" : "text-ink-subtle"}`}>{count}</span>
              </button>
            );
          })}
      </div>

      <div className="space-y-2">
        {rows.length === 0 ?
          <p className="text-xs text-ink-subtle">Пусто — ни одной встречи в этом разделе.</p>
        : rows.map((s) => <SeriesCard key={s.id} s={s} onChange={refresh} />)}
      </div>
    </div>
  );
}
