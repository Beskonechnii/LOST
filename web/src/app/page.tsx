"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AdvantageChart,
  BuildingMap,
  EventBadges,
  HeroFrame,
  HeroPortrait,
  Icon,
  ItemsRow,
  TalentTreeMini,
  TeamCrest,
} from "./_components/postgame/blocks";
import { PostgameExport } from "./_components/postgame/export-canvas";
import { MatchArchive, useArchive } from "./_components/match-archive";
import {
  clock,
  fmt,
  initials,
  kFmt1,
  pad,
  type MatchReport,
  type PickBan,
  type PlayerReport,
  type Side,
  type TalentOpt,
  type TalentTier,
} from "./_components/postgame/types";

// Команда из ростера — для подстановки наших лого/тегов по названию или составу матча.
type RosterTeam = { name: string; tag: string | null; logo: string | null; accountIds: string[] };

// --- Шапка со счётом (блок 1 референса: лого · имя · бейджи | время · счёт · дата | имя · лого) ---
function TeamSide({
  name,
  onName,
  logo,
  won,
  chips,
  align,
}: {
  name: string;
  onName: (v: string) => void;
  logo: string | null;
  won: boolean;
  chips: ReactNode;
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
      <div className={`mt-1 flex flex-wrap items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
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
    <div className="flex flex-1 items-center gap-3">
      {align === "left" ? (
        <>
          {mono}
          {nameBlock}
        </>
      ) : (
        <>
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
  logos,
}: {
  match: MatchReport;
  names: { radiant: string; dire: string };
  setNames: (u: (s: { radiant: string; dire: string }) => { radiant: string; dire: string }) => void;
  logos: { radiant: string | null; dire: string | null };
}) {
  // Итоговое преимущество (последний отсчёт adv) — чипами у стороны-лидера, как на рефе.
  const gold = match.goldAdv.at(-1) ?? 0;
  const xp = match.xpAdv.at(-1) ?? 0;
  const chip = (v: number, label: string, cls: string) => (
    <span
      key={label}
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ring-1 ${cls}`}
      title={`Итоговое преимущество: ${label}`}
    >
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
    <div className="flex items-center gap-3 md:gap-5">
      <TeamSide
        name={names.radiant}
        onName={(v) => setNames((s) => ({ ...s, radiant: v }))}
        logo={logos.radiant}
        won={match.radiantWin}
        chips={sideChips("radiant")}
        align="left"
      />
      <div className="flex shrink-0 flex-col items-center px-2">
        <div className="text-[10px] uppercase tracking-widest text-neutral-500">⏱ {clock(match.durationSeconds)}</div>
        <div className="text-3xl font-black tabular-nums md:text-4xl">
          <span className="text-emerald-400">{match.radiantScore}</span>
          <span className="text-neutral-600"> – </span>
          <span className="text-rose-400">{match.direScore}</span>
        </div>
        <div className="text-[10px] text-neutral-600">
          {d
            ? `${d.toLocaleDateString("ru-RU")} в ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} · `
            : ""}
          #{match.matchId}
        </div>
      </div>
      <TeamSide
        name={names.dire}
        onName={(v) => setNames((s) => ({ ...s, dire: v }))}
        logo={logos.dire}
        won={!match.radiantWin}
        chips={sideChips("dire")}
        align="right"
      />
    </div>
  );
}

// --- Полоса героев (блок 2 референса): 5+5 портретов, под каждым ник ---
function HeroStrip({ radiant, dire }: { radiant: PlayerReport[]; dire: PlayerReport[] }) {
  const group = (list: PlayerReport[], side: Side) => (
    <div
      key={side}
      className={`grid flex-1 grid-cols-5 gap-1.5 rounded-lg p-2 ${side === "radiant" ? "bg-emerald-950/15" : "bg-rose-950/15"}`}
    >
      {pad(list, 5).map((p, i) =>
        p ? (
          <div key={i} className="flex min-w-0 flex-col items-center gap-1">
            <HeroPortrait hero={p.hero} />
            <span
              className="w-full truncate text-center text-[11px] font-semibold text-neutral-200"
              title={`${p.name}${p.role ? ` · ${p.role}` : ""}`}
            >
              {p.name}
            </span>
          </div>
        ) : (
          <div key={i} className="aspect-video w-full rounded-md bg-neutral-800/40" />
        ),
      )}
    </div>
  );
  return (
    <div className="flex flex-col gap-3 md:flex-row">
      {group(radiant, "radiant")}
      {group(dire, "dire")}
    </div>
  );
}

// --- Баны (блок 4 референса): одна полоса, кластеры по командам, иконки перечёркнуты ---
function BansStrip({ picksBans }: { picksBans: PickBan[] }) {
  const bans = picksBans.filter((pb) => !pb.isPick);
  if (bans.length === 0) return null;
  const group = (side: Side) => (
    <div className={`flex flex-wrap items-center gap-1 ${side === "dire" ? "justify-end" : ""}`}>
      {bans
        .filter((b) => b.side === side)
        .map((b) => (
          <HeroFrame key={b.order} hero={b.hero} side={side} h={24} banned title={`бан ${b.order + 1}: ${b.hero.name}`} />
        ))}
    </div>
  );
  return (
    <div className="flex items-center justify-between gap-4">
      {group("radiant")}
      <span className="shrink-0 text-[10px] uppercase tracking-widest text-neutral-500">Баны</span>
      {group("dire")}
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
      <HeroFrame hero={pb.hero} side={pb.side} h={18} banned={!pb.isPick} />
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

// --- Скорборд карточками (реф 2, панель «Statistics» cyberscore) ---
// Карточка героя в тоне команды: портрет+уровень, тег+ник+роль, XPM/GPM,
// KDA, NET-бар (относительно максимума в матче), урон, ЛХ/ДН, предметы, таланты.
function HeroCard({
  p,
  side,
  tag,
  maxNet,
}: {
  p: PlayerReport;
  side: Side;
  tag: string;
  maxNet: number;
}) {
  const tint =
    side === "radiant"
      ? "border-emerald-900/40 bg-emerald-950/15 hover:bg-emerald-950/25"
      : "border-rose-900/40 bg-rose-950/15 hover:bg-rose-950/25";
  const box = (label: string, v: number) => (
    <span key={label} className="rounded bg-neutral-800/70 px-1.5 py-0.5 text-[10px] tabular-nums text-neutral-200">
      <span className="text-neutral-500">{label} </span>
      <span className="font-bold">{v}</span>
    </span>
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
        {/* тег+ник+роль → XPM/GPM + KDA → NET-бар + опыт + ЛХ/ДН */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className={`shrink-0 text-[10px] font-black uppercase ${side === "radiant" ? "text-emerald-400" : "text-rose-400"}`}>
              {tag}
            </span>
            <span className="truncate text-sm font-semibold text-neutral-100" title={p.name}>
              {p.name}
            </span>
            {p.role && <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-neutral-500">{p.role}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {box("XPM", p.xpm)}
            {box("GPM", p.gpm)}
            <span className="text-[11px] font-semibold tabular-nums" title="Убийства / смерти / помощь">
              <span className="text-neutral-500">KDA </span>
              <span className="text-emerald-400">{p.kills}</span>
              <span className="text-neutral-600">/</span>
              <span className="text-rose-400">{p.deaths}</span>
              <span className="text-neutral-600">/</span>
              <span className="text-sky-300">{p.assists}</span>
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="relative h-4 min-w-0 flex-1 overflow-hidden rounded bg-neutral-800/60" title="Ценность (net worth)">
              <div
                className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-amber-600 to-amber-400"
                style={{ width: `${Math.max(4, (p.netWorth / maxNet) * 100)}%` }}
              />
              <span
                className="absolute inset-0 grid place-items-center text-[10px] font-bold text-white"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,.8)" }}
              >
                {fmt(p.netWorth)}
              </span>
            </div>
            <span className="shrink-0 text-[10px] tabular-nums text-neutral-400" title="Урон по героям">
              <span className="text-neutral-500">УРОН </span>
              {fmt(p.heroDamage)}
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-neutral-400" title="Ласт-хиты / денаи">
              <span className="text-neutral-500">ЛХ/ДН </span>
              {p.lastHits}/{p.denies}
            </span>
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
  tag,
  maxNet,
  players,
  score,
  won,
}: {
  side: "radiant" | "dire";
  fallback: string;
  teamName: string;
  logo: string | null;
  tag: string;
  maxNet: number;
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
          <HeroCard key={i} p={p} side={side} tag={tag} maxNet={maxNet} />
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
  tags,
  maxNet,
  radiantScore,
  direScore,
  radiantWin,
}: {
  radiant: PlayerReport[];
  dire: PlayerReport[];
  names: { radiant: string; dire: string };
  logos: { radiant: string | null; dire: string | null };
  tags: { radiant: string; dire: string };
  maxNet: number;
  radiantScore: number;
  direScore: number;
  radiantWin: boolean;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <CardTeam
        side="radiant"
        fallback="Свет"
        teamName={names.radiant}
        logo={logos.radiant}
        tag={tags.radiant}
        maxNet={maxNet}
        players={radiant}
        score={radiantScore}
        won={radiantWin}
      />
      <CardTeam
        side="dire"
        fallback="Тьма"
        teamName={names.dire}
        logo={logos.dire}
        tag={tags.dire}
        maxNet={maxNet}
        players={dire}
        score={direScore}
        won={!radiantWin}
      />
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

// --- Доп. информация: скиллы и покупки ---
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

type Tab = "report" | "extra" | "export";

export default function Home() {
  const [id, setId] = useState("");
  // Не просто «грузится», а какой источник грузится — чтобы спиннер был на нажатой кнопке.
  const [loading, setLoading] = useState<"opendota" | "steam" | null>(null);
  const [source, setSource] = useState<"opendota" | "steam">("opendota");
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchReport | null>(null);
  // Только то, что вручную вписал пользователь; «» — значит взять распознанное/из OpenDota (см. names ниже).
  const [manual, setManual] = useState({ radiant: "", dire: "" });
  const [tab, setTab] = useState<Tab>("report");
  const [roster, setRoster] = useState<RosterTeam[]>([]);
  // Архив — выгруженные картинки на диске (public/uploads/postgame), а не шапки матчей.
  const archive = useArchive();

  // Команды лиги — для подстановки наших лого и тегов по названию (наши ассеты приоритетнее OpenDota).
  useEffect(() => {
    fetch("/api/roster/teams")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: RosterTeam[]) => setRoster(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  // account_id → команда лиги: по этой карте состав матча распознаётся автоматически.
  const teamByAccount = useMemo(() => {
    const m = new Map<string, RosterTeam>();
    for (const t of roster) for (const a of t.accountIds) m.set(a, t);
    return m;
  }, [roster]);

  // Команда лиги по составу стороны: та, чьих игроков в пятёрке больше всего (минимум двое,
  // чтобы случайное совпадение одного account_id не переименовало команду).
  const detectTeam = useMemo(
    () =>
      (players: PlayerReport[]): RosterTeam | null => {
        const tally = new Map<RosterTeam, number>();
        for (const p of players) {
          const t = p.accountId != null ? teamByAccount.get(String(p.accountId)) : undefined;
          if (t) tally.set(t, (tally.get(t) ?? 0) + 1);
        }
        let best: RosterTeam | null = null;
        let bestN = 0;
        for (const [t, n] of tally) if (n > bestN) [best, bestN] = [t, n];
        return bestN >= 2 ? best : null;
      },
    [teamByAccount],
  );

  // Источник матча выбирается кнопкой: OpenDota богаче (график золота, события, тайминги),
  // Steam — первоисточник Valve, выручает когда OpenDota недоступна. См. lib/steam-match.ts.
  // matchId передаётся при открытии из архива: там id известен сразу, ждать setId нельзя.
  async function load(src: "opendota" | "steam", matchId?: string) {
    const clean = (matchId ?? id).trim();
    if (!clean) return;
    if (matchId) setId(matchId);
    setLoading(src);
    setError(null);
    setMatch(null);
    try {
      const res = await fetch(`/api/${src}/match/${clean}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка запроса");
      const m = json.match as MatchReport;
      setMatch(m);
      setSource(src);
      setManual({ radiant: "", dire: "" }); // сброс прежних ручных правок под новый матч
      setTab("report");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  }

  const radiant = (match?.players.filter((p) => p.side === "radiant") ?? []).slice().sort((a, b) => a.pos - b.pos);
  const dire = (match?.players.filter((p) => p.side === "dire") ?? []).slice().sort((a, b) => a.pos - b.pos);
  const byPos = [...radiant, ...dire];

  // Итоговые названия сторон — производные (не в state), поэтому распознавание срабатывает и когда
  // ростер догрузился после матча: ручной ввод → команда по составу → название из OpenDota → пусто.
  const names = {
    radiant: manual.radiant || detectTeam(radiant)?.name || match?.radiantTeam || "",
    dire: manual.dire || detectTeam(dire)?.name || match?.direTeam || "",
  };
  const setNames = (u: (s: { radiant: string; dire: string }) => { radiant: string; dire: string }) =>
    setManual((m) => u({ radiant: m.radiant, dire: m.dire }));

  // Команда лиги по введённому названию (или тегу) — без учёта регистра.
  const fromRoster = (name: string): RosterTeam | null => {
    const q = name.trim().toLowerCase();
    if (!q) return null;
    return roster.find((t) => t.name.toLowerCase() === q || (t.tag ?? "").toLowerCase() === q) ?? null;
  };
  const rosterTeams = { radiant: fromRoster(names.radiant), dire: fromRoster(names.dire) };
  // Лого: наш ассет по названию → лого OpenDota → монограмма (в TeamCrest).
  const logos = {
    radiant: rosterTeams.radiant?.logo ?? match?.radiantLogo ?? null,
    dire: rosterTeams.dire?.logo ?? match?.direLogo ?? null,
  };
  // Теги команд для бейджей и карточек: ростер → OpenDota → инициалы введённого имени.
  const tags = {
    radiant: (rosterTeams.radiant?.tag || match?.radiantTag || initials(names.radiant || "Свет")).slice(0, 4),
    dire: (rosterTeams.dire?.tag || match?.direTag || initials(names.dire || "Тьма")).slice(0, 4),
  };
  // Максимум net worth в матче — база для NET-баров карточек.
  const maxNet = Math.max(1, ...(match?.players.map((p) => p.netWorth) ?? [1]));

  const tabs: { key: Tab; label: string }[] = [
    { key: "report", label: "Отчёт" },
    { key: "extra", label: "Доп. статистика" },
    { key: "export", label: "Экспорт PNG" },
  ];

  return (
    <main className="flex-1 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">LOST — импорт матча</h1>
            <p className="text-sm text-neutral-400">
              Вставь ID матча Dota 2 — постгейм-отчёт подтянется из OpenDota, а если она лежит, то из Steam.
              Команды переименовываешь под LOST.
            </p>
          </div>
        </div>
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load("opendota")}
            placeholder="ID матча Dota 2, напр. 8907510684"
            inputMode="numeric"
            className="w-full max-w-xs rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <button
            onClick={() => load("opendota")}
            disabled={!!loading || !id.trim()}
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
          >
            {loading === "opendota" ? "Загрузка…" : "Из OpenDota"}
          </button>
          {/* Запасной источник: беднее данными, но живёт независимо от аварий OpenDota. */}
          <button
            onClick={() => load("steam")}
            disabled={!!loading || !id.trim()}
            title="Первоисточник Valve: без графика золота, таймингов покупок, событий и ников"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 hover:border-neutral-500 hover:text-white disabled:opacity-50"
          >
            {loading === "steam" ? "Загрузка…" : "Из Steam"}
          </button>
        </div>

        <MatchArchive items={archive.items} onOpen={(e) => load(e.source, e.matchId)} onChanged={archive.reload} />

        {error && (
          <p className="rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">{error}</p>
        )}

        {match && (
          <div className="space-y-4">
            {/* заголовок в духе постгейма + вкладки */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 font-black text-white">
                  L
                </div>
                <h1 className="text-lg font-black uppercase tracking-tight md:text-xl">Postgame Stats</h1>
                <span className="text-[11px] text-amber-400">{match.parsed ? "" : "⚠ не распарсен"}</span>
                {/* Откуда данные — иначе непонятно, почему у матча из Steam пустые график и события. */}
                {source === "steam" && (
                  <span
                    className="rounded border border-neutral-700 px-1.5 py-0.5 text-[11px] text-neutral-400"
                    title="Steam не отдаёт график золота, тайминги покупок, события и ники"
                  >
                    источник: Steam
                  </span>
                )}
              </div>
              <div className="flex gap-1 rounded-lg bg-neutral-950/60 p-1">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      tab === t.key ? "bg-violet-600 text-white" : "text-neutral-400 hover:text-neutral-100"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {tab === "report" && (
              <>
                {/* Блок 1 — сводка матча единым блоком (по референсу):
                    шапка → герои → баны → низ: карта строений + события | график преимущества */}
                <div className="divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900/50">
                  <div className="p-3 md:p-4">
                    <ScoreHeader match={match} names={names} setNames={setNames} logos={logos} />
                  </div>
                  <div className="p-3">
                    <HeroStrip radiant={radiant} dire={dire} />
                  </div>
                  <div className="px-3 py-2">
                    <BansStrip picksBans={match.picksBans} />
                  </div>
                  {/* карта — узкая фиксированная колонка, график забирает всю остальную ширину */}
                  <div className="grid gap-4 p-3 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="space-y-3">
                      <BuildingMap buildings={match.buildings} />
                      <EventBadges events={match.events} tags={tags} />
                    </div>
                    {match.goldAdv.length >= 2 && (
                      <div className="min-w-0">
                        <AdvantageChart gold={match.goldAdv} xp={match.xpAdv} />
                      </div>
                    )}
                  </div>
                </div>

                <CardScoreboard
                  radiant={radiant}
                  dire={dire}
                  names={names}
                  logos={logos}
                  tags={tags}
                  maxNet={maxNet}
                  radiantScore={match.radiantScore}
                  direScore={match.direScore}
                  radiantWin={match.radiantWin}
                />
              </>
            )}

            {tab === "extra" && (
              <>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                  <div className="mb-3 text-sm font-medium text-neutral-300">Скиллы и покупки (по игрокам)</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {byPos.map((p, i) => (
                      <PlayerDetails key={i} p={p} />
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                  <Draft picksBans={match.picksBans} names={names} />
                </div>
              </>
            )}

            {tab === "export" && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                {/* В архив уходит подпись ровно с теми названиями, что нарисованы на картинке. */}
                <PostgameExport
                  match={match}
                  names={names}
                  tags={tags}
                  logos={logos}
                  meta={{
                    matchId: match.matchId,
                    source,
                    radiant: names.radiant || "Свет",
                    dire: names.dire || "Тьма",
                    radiantScore: match.radiantScore,
                    direScore: match.direScore,
                    radiantWin: match.radiantWin,
                  }}
                  onSaved={archive.reload}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
