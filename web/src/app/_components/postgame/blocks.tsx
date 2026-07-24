"use client";

// Общие блоки постгейм-отчёта: иконки, инвентарь, таланты, график преимущества,
// карта строений и бейджи событий. Их рендерят и страница матча (адаптивная),
// и экспортный холст (фиксированные пиксели) — поэтому здесь нет media-брейкпоинтов:
// при снятии PNG media-query могут пересчитаться и сломать раскладку.

import { useState, type MouseEvent } from "react";
import { assetUrl, assetFallback, type AssetKind } from "@/lib/assets";
import {
  clock,
  fmt,
  initials,
  kFmt,
  niceCeil,
  pad,
  type Entity,
  type Lane,
  type MatchEvents,
  type MatchReport,
  type PlayerReport,
  type Side,
  type TalentOpt,
  type TalentTier,
} from "./types";

// Иконка ассета. src — локальный /assets/…; при 404 один раз пробуем CDN Valve, потом прячем.
export function Icon({ kind, slug, name, h = 24, className = "" }: { kind: AssetKind; slug: string; name: string; h?: number; className?: string }) {
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
export function HeroPortrait({ hero, dim }: { hero: Entity; dim?: boolean }) {
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

// Герб команды: лого (из ростера или OpenDota), при отсутствии/ошибке — монограмма-заглушка.
export function TeamCrest({ logo, name, size = 44 }: { logo: string | null; name: string; size?: number }) {
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
        style={{ width: size, height: size }}
        className="shrink-0 rounded-lg object-contain ring-1 ring-neutral-700"
      />
    );
  return (
    <div
      style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
      className="grid shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 font-black text-white shadow"
    >
      {initials(name)}
    </div>
  );
}

// Слот предмета фиксированного размера: иконка либо пустая ячейка (item-иконки ~4:3).
export function ItemSlot({ item, h, className = "" }: { item: Entity | null; h: number; className?: string }) {
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
// size — высота базовой иконки: страница рендерит 22, экспортный холст — компактнее.
export function ItemsRow({ p, size = 22 }: { p: PlayerReport; size?: number }) {
  const base = pad(p.items, 6);
  const back = pad(p.backpack, 3);
  const small = Math.max(10, Math.round(size * 0.72));
  const neutral = p.neutral && p.neutral.slug ? p.neutral : null;
  const sep = "border-l border-neutral-700/60 pl-1.5";
  return (
    <div className="flex items-center gap-1.5">
      {/* 6 базовых */}
      <div className="flex gap-0.5">
        {base.map((it, i) => (
          <ItemSlot key={i} item={it} h={size} />
        ))}
      </div>
      {/* рюкзак (3) */}
      <div className={`flex gap-0.5 ${sep}`}>
        {back.map((it, i) => (
          <ItemSlot key={i} item={it} h={small} />
        ))}
      </div>
      {/* нейтральный предмет */}
      <div className={sep}>
        {neutral ? (
          <Icon kind="items" slug={neutral.slug} name={neutral.name} h={size} className="!rounded-full !ring-amber-500/70" />
        ) : (
          <div style={{ width: size, height: size }} className="rounded-full bg-neutral-800/50 ring-1 ring-inset ring-amber-700/30" />
        )}
      </div>
      {/* Аганим (скипетр) + Шард — подсвечены при наличии */}
      <div className={`flex gap-1 ${sep}`}>
        <Icon
          kind="items"
          slug="ultimate_scepter"
          name="Аганим (скипетр)"
          h={small}
          className={p.hasScepter ? "!ring-fuchsia-500/70" : "opacity-20 grayscale"}
        />
        <Icon
          kind="items"
          slug="aghanims_shard"
          name="Аганим (шард)"
          h={small}
          className={p.hasShard ? "!ring-sky-500/70" : "opacity-20 grayscale"}
        />
      </div>
    </div>
  );
}

// Компактное дерево талантов для строки: 4 яруса (25→10), лево | уровень | право.
// Позиции лево/право — как в игре; выбранная сторона золотая. Полный текст — в подсказке.
export function TalentTreeMini({ talents }: { talents: TalentTier[] }) {
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

// Интерактивный график преимущества: золото (заливка + линия) и опыт (пунктир), общая шкала.
// Ось Y слева подписана значениями золота (верх — Свет, низ — Тьма), по X — тики времени.
// Наведение → вертикальный курсор с золотом/опытом на этой минуте.
// interactive={false} — статичный вариант для экспорта в PNG (без hover-состояний).
// w/h задают viewBox: экспорт подбирает пропорции под свой холст.
export function AdvantageChart({
  gold,
  xp,
  interactive = true,
  w = 660,
  h = 200,
}: {
  gold: number[];
  xp: number[];
  interactive?: boolean;
  w?: number;
  h?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = gold.length;
  if (n < 2) return null;
  const hasXp = xp.length === n;
  const W = w,
    H = h,
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
  const xpLine = hasXp ? path(xp) : "";
  const area = `${goldLine} L${x(n - 1).toFixed(1)},${mid} L${padL},${mid} Z`;
  const yTicks = [top, top / 2, 0, -top / 2, -top];
  const xStep = Math.max(1, Math.round((n - 1) / 6)); // ~6 подписей времени
  // Цвет по лидеру: верхняя половина (Свет) — зелёный, нижняя (Тьма) — красный.
  const EMERALD = "rgb(52 211 153)";
  const ROSE = "rgb(251 113 133)";

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
            <span className="inline-block h-0.5 w-4 bg-neutral-300" />золото
          </span>
          {hasXp && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-0 w-4 border-t border-dashed border-neutral-400" />опыт
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-emerald-400" />Свет
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-rose-400" />Тьма
          </span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        onMouseMove={interactive ? onMove : undefined}
        onMouseLeave={interactive ? () => setHover(null) : undefined}
      >
        <defs>
          <linearGradient id="adv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0.35" />
            <stop offset="50%" stopColor="rgb(120 120 120)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="rgb(251 113 133)" stopOpacity="0.35" />
          </linearGradient>
          {/* верх/низ графика — для двухцветной линии (лидирует Свет / Тьма) */}
          <clipPath id="advTop">
            <rect x={padL} y={padT - 2} width={plotW} height={plotH / 2 + 2} />
          </clipPath>
          <clipPath id="advBot">
            <rect x={padL} y={mid} width={plotW} height={plotH / 2 + 2} />
          </clipPath>
        </defs>
        {/* сетка + подписи оси Y (без минуса: верх — Свет, низ — Тьма) */}
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
              className={v > 0 ? "fill-emerald-500/80" : v < 0 ? "fill-rose-500/80" : "fill-neutral-500"}
              style={{ fontSize: 9 }}
            >
              {kFmt(Math.abs(v))}
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
        {/* линии рисуются дважды с клипом по половинам: над нулём — зелёные, под — красные */}
        {hasXp && (
          <>
            <path d={xpLine} clipPath="url(#advTop)" fill="none" stroke={EMERALD} strokeWidth="1.4" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.8" />
            <path d={xpLine} clipPath="url(#advBot)" fill="none" stroke={ROSE} strokeWidth="1.4" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.8" />
          </>
        )}
        <path d={goldLine} clipPath="url(#advTop)" fill="none" stroke={EMERALD} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={goldLine} clipPath="url(#advBot)" fill="none" stroke={ROSE} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {/* курсор наведения */}
        {interactive && hover != null && (
          <g>
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={H - padB} stroke="rgb(163 163 163)" strokeWidth="0.6" />
            <circle cx={x(hover)} cy={y(gold[hover])} r="2.6" fill={gold[hover] >= 0 ? EMERALD : ROSE} />
            {hasXp && <circle cx={x(hover)} cy={y(xp[hover])} r="2.4" fill={xp[hover] >= 0 ? EMERALD : ROSE} />}
            {/* тултип: без минусов — цвет говорит, кто ведёт */}
            <g transform={`translate(${Math.min(x(hover) + 6, W - 128)}, ${padT + 4})`}>
              <rect width="122" height={hasXp ? 46 : 32} rx="4" fill="rgb(10 10 10)" stroke="rgb(64 64 64)" strokeWidth="0.5" />
              <text x="8" y="14" className="fill-neutral-300" style={{ fontSize: 9 }}>
                {`${hover} мин`}
              </text>
              <text x="8" y="27" style={{ fontSize: 9 }} className={gold[hover] >= 0 ? "fill-emerald-400" : "fill-rose-400"}>
                {`золото ${fmt(Math.abs(gold[hover]))}`}
              </text>
              {hasXp && (
                <text x="8" y="40" style={{ fontSize: 9 }} className={xp[hover] >= 0 ? "fill-emerald-400" : "fill-rose-400"}>
                  {`опыт ${fmt(Math.abs(xp[hover]))}`}
                </text>
              )}
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

// --- Карта строений: настоящая миникарта из игры + маркеры строений ---
// Подложка — public/assets/map/minimap.jpg (detailed-карта из odota/web, свет — низ-лево).
// Координаты в процентах карты (x вправо, y вниз), сняты с мировых координат вышек.
// Позиции строений — из OpenDota (odota/web BuildingMap/buildingData733.ts, карта 7.33+),
// выверены под ту же подложку detailed_740.jpg. Их top/left — угол иконки; здесь пересчитано
// в центры (+полразмера иконки: вышка 16px, казармы 12px, трон 25px на карте 300px).
const TOWER_XY: Record<Side, Record<Lane, Record<1 | 2 | 3, [number, number]>>> = {
  radiant: {
    top: { 1: [12.2, 38.7], 2: [11.7, 55.7], 3: [10.7, 70.7] },
    mid: { 1: [40.7, 56.7], 2: [30.2, 65.7], 3: [21.2, 74.2] },
    bot: { 1: [77.7, 84.7], 2: [48.7, 87.7], 3: [25.7, 86.2] },
  },
  dire: {
    top: { 1: [20.7, 14.7], 2: [51.7, 13.7], 3: [72.7, 15.2] },
    mid: { 1: [53.7, 46.2], 2: [66.7, 35.7], 3: [75.7, 26.7] },
    bot: { 1: [86.7, 62.7], 2: [87.7, 47.7], 3: [88.2, 30.7] },
  },
};
// Казармы — за Т3 внутри базы; ranged всегда слева от melee, если смотреть в сторону противника.
const RACK_XY: Record<Side, Record<Lane, { ranged: [number, number]; melee: [number, number] }>> = {
  radiant: {
    top: { ranged: [8.5, 72.5], melee: [12.5, 72.5] },
    mid: { ranged: [17, 74], melee: [20, 76.5] },
    bot: { ranged: [22, 82.5], melee: [22, 86.5] },
  },
  dire: {
    top: { ranged: [76, 12], melee: [76, 16] },
    mid: { ranged: [76.5, 21.5], melee: [79.5, 24] },
    bot: { ranged: [86, 26], melee: [90, 26] },
  },
};
// Трон (ориентир) и пара вышек 4-го тира перед ним, со стороны мида.
const ANCIENT_XY: Record<Side, { core: [number, number]; top: [number, number]; bottom: [number, number] }> = {
  radiant: { core: [9.2, 87.2], top: [10.7, 81.7], bottom: [14.7, 84.7] },
  dire: { core: [88.2, 13.2], top: [83.7, 15.7], bottom: [86.7, 18.7] },
};

// legend={false} — экспортный холст рисует свою (компактную) легенду сам.
export function BuildingMap({ buildings, legend = true }: { buildings: MatchReport["buildings"]; legend?: boolean }) {
  const color = (side: Side) => (side === "radiant" ? "#34d399" : "#fb7185");
  // Целое — цвет стороны, уничтоженное — белое; тёмная обводка, чтобы читалось на карте.
  const fill = (side: Side, alive: boolean) => (alive ? color(side) : "#ffffff");
  const stroke = (alive: boolean) => (alive ? "rgba(0,0,0,0.65)" : "#737373");
  const sides: Side[] = ["radiant", "dire"];
  return (
    <div>
      {legend && (
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
      )}
      <svg viewBox="0 0 100 100" className="mx-auto block aspect-square w-full max-w-[300px] overflow-hidden rounded-lg">
        {/* фолбэк-подложка на случай, если файл карты не свендорен */}
        <polygon points="0,0 100,0 0,100" fill="rgba(52,211,153,0.06)" />
        <polygon points="100,0 100,100 0,100" fill="rgba(251,113,133,0.06)" />
        {/* сама карта + лёгкое затемнение, чтобы маркеры не терялись */}
        <image href="/assets/map/minimap.jpg" x="0" y="0" width="100" height="100" preserveAspectRatio="none" />
        <rect x="0" y="0" width="100" height="100" fill="black" opacity="0.25" />
        {sides.map((side) => {
          const b = buildings[side];
          const anc = ANCIENT_XY[side];
          return (
            <g key={side}>
              {/* казармы: кружки за Т3, ranged слева от melee (лицом к противнику) */}
              {b.racks.map((r) => {
                const rk = RACK_XY[side][r.lane];
                const sideName = side === "radiant" ? "Свет" : "Тьма";
                return (
                  <g key={`${side}-rk-${r.lane}`}>
                    <circle cx={rk.ranged[0]} cy={rk.ranged[1]} r="1.4" fill={fill(side, r.ranged)} stroke={stroke(r.ranged)} strokeWidth="0.4">
                      <title>{`${sideName} · ${r.lane} казармы (ranged)${r.ranged ? "" : " — уничтожены"}`}</title>
                    </circle>
                    <circle cx={rk.melee[0]} cy={rk.melee[1]} r="1.4" fill={fill(side, r.melee)} stroke={stroke(r.melee)} strokeWidth="0.4">
                      <title>{`${sideName} · ${r.lane} казармы (melee)${r.melee ? "" : " — уничтожены"}`}</title>
                    </circle>
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
                    stroke={stroke(t.alive)}
                    strokeWidth="0.5"
                  >
                    <title>{`${side === "radiant" ? "Свет" : "Тьма"} · ${t.lane} T${t.tier}${t.alive ? "" : " (уничтожена)"}`}</title>
                  </rect>
                );
              })}
              {/* трон (ромб-ориентир) + пара вышек 4-го тира перед ним */}
              <rect
                x={anc.core[0] - 2.4}
                y={anc.core[1] - 2.4}
                width="4.8"
                height="4.8"
                transform={`rotate(45 ${anc.core[0]} ${anc.core[1]})`}
                fill="none"
                stroke={color(side)}
                strokeWidth="0.7"
                opacity="0.8"
              >
                <title>{`Трон · ${side === "radiant" ? "Свет" : "Тьма"}`}</title>
              </rect>
              {(["top", "bottom"] as const).map((k) => {
                const [x, y] = anc[k];
                const alive = b.ancient[k];
                return (
                  <rect
                    key={`${side}-anc-${k}`}
                    x={x - 1.7}
                    y={y - 1.7}
                    width="3.4"
                    height="3.4"
                    rx="0.6"
                    fill={fill(side, alive)}
                    stroke={stroke(alive)}
                    strokeWidth="0.5"
                  >
                    <title>{`${side === "radiant" ? "Свет" : "Тьма"} · вышка Т4 у трона${alive ? "" : " (уничтожена)"}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --- Бейджи событий (FB / FT / R + наш C — курьеры) ---
// Круг в цвете стороны, взявшей событие; под ним тег команды; детали — в подсказке.
export function EventBadges({ events, tags, size = 32 }: { events: MatchEvents; tags: { radiant: string; dire: string }; size?: number }) {
  const { firstBlood, firstTower, roshan, couriers } = events;
  const list: { label: string; hint: string; side: Side | null; title: string }[] = [];
  if (firstBlood)
    list.push({
      label: "FB",
      hint: "Первая кровь",
      side: firstBlood.side,
      title: `${firstBlood.killer ? `${firstBlood.killer.name} (${firstBlood.killer.hero.name})` : tags[firstBlood.side]} · ${clock(firstBlood.time)}`,
    });
  if (firstTower)
    list.push({
      label: "FT",
      hint: "Первая вышка",
      side: firstTower.side,
      title: `${firstTower.killer ? `${firstTower.killer.name} (${firstTower.killer.hero.name})` : tags[firstTower.side]} · ${clock(firstTower.time)}`,
    });
  if (roshan.kills.length > 0) {
    const side: Side =
      roshan.radiant === roshan.dire
        ? roshan.kills[roshan.kills.length - 1].side
        : roshan.radiant > roshan.dire
          ? "radiant"
          : "dire";
    list.push({
      label: "R",
      hint: "Рошан",
      side,
      title: `${roshan.radiant}:${roshan.dire} · ${roshan.kills.map((k) => clock(k.time)).join(", ")}`,
    });
  }
  if (couriers.kills.length > 0) {
    const side: Side | null =
      couriers.radiant === couriers.dire ? null : couriers.radiant > couriers.dire ? "radiant" : "dire";
    list.push({ label: "C", hint: "Курьеры", side, title: `${couriers.radiant}:${couriers.dire}` });
  }
  if (list.length === 0) return null;
  const cls = (s: Side | null) =>
    s === "radiant"
      ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/40"
      : s === "dire"
        ? "bg-rose-500/15 text-rose-400 ring-rose-500/40"
        : "bg-neutral-800 text-neutral-400 ring-neutral-700";
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {list.map((b) => (
        <div key={b.label} className="flex flex-col items-center gap-0.5" title={`${b.hint}: ${b.title}`}>
          <span
            style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
            className={`grid place-items-center rounded-full font-black ring-1 ${cls(b.side)}`}
          >
            {b.label}
          </span>
          <span className="max-w-12 truncate text-[9px] font-semibold uppercase text-neutral-500">
            {b.side ? tags[b.side] : "="}
          </span>
        </div>
      ))}
    </div>
  );
}
