import type { BoardItem, BoardPlayer, BoardTeam, Data, TemplateDef } from "../types";
import { asBoard, asText } from "../types";
import { Bg } from "./parts";
import { Icon } from "./postgame-icon";

// Пост-гейм скорборд карты, 1920×1080 (референс: Falcons vs Tundra). Два блока команд друг под
// другом, разделённые перегородкой; внутри строки — вертикальные линии между колонками
// identity | K/D/A | HERO DMG | предметы. Ширины колонок ниже — общие для шапки и строк, поэтому
// подписи стоят ровно над данными, а перегородки идут сплошняком. Данные приходят одним полем
// kind:"match": matchId разворачивается в ScoreBoard на сервере (src/lib/scoreboard.ts).
//
// Файл — общий модуль (без "use client"): иначе его экспорт TemplateDef на сервере становится
// client-reference и getTemplate его не находит. Интерактив (onError) вынесен в лист Icon.

const W = 1920;
const H = 1080;
const FONT = "var(--studio-font, system-ui)";
const DEFAULT_ACCENT = "#a855f7";

// Ширины колонок статистики — общие для шапки блока и строк игроков, чтобы перегородки совпадали.
const KDA_W = 150;
const DMG_W = 160;
const ITEMS_W = 424;
const NEUTRAL_W = 62;
const HAIR = "1px solid rgba(255,255,255,.22)"; // вертикальная перегородка между колонками

const PANEL_H = 452; // высота блока команды
const HEAD_H = 82; // шапка блока
const ROW_H = (PANEL_H - HEAD_H) / 5; // строка игрока

const num = (n: number) => n.toLocaleString("ru-RU");

/** Полоса предметов: 6 основных · бэкпак (3 мельче) · нейтрал живёт в отдельной колонке справа. */
function Items({ p }: { p: BoardPlayer }) {
  const main: (BoardItem | null)[] = [...p.items, ...Array(6).fill(null)].slice(0, 6);
  const back: (BoardItem | null)[] = [...p.backpack, ...Array(3).fill(null)].slice(0, 3);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {main.map((it, i) => (
        <Icon key={`m${i}`} kind="items" slug={it?.slug ?? ""} name={it?.name ?? ""} w={52} h={38} />
      ))}
      <div style={{ display: "flex", gap: 4, marginLeft: 4, paddingLeft: 8, borderLeft: HAIR }}>
        {back.map((it, i) => (
          <Icon key={`b${i}`} kind="items" slug={it?.slug ?? ""} name={it?.name ?? ""} w={34} h={26} />
        ))}
      </div>
    </div>
  );
}

/** Ячейки статистики строки/шапки — единые ширины и перегородки. */
function StatCols({
  kda,
  dmg,
  items,
  neutral,
}: {
  kda: React.ReactNode;
  dmg: React.ReactNode;
  items: React.ReactNode;
  neutral: React.ReactNode;
}) {
  return (
    <>
      <div style={{ width: KDA_W, display: "grid", placeItems: "center", borderLeft: HAIR, height: "100%" }}>{kda}</div>
      <div style={{ width: DMG_W, display: "grid", placeItems: "center", borderLeft: HAIR, height: "100%" }}>{dmg}</div>
      <div style={{ width: ITEMS_W, display: "flex", alignItems: "center", paddingLeft: 16, borderLeft: HAIR, height: "100%" }}>
        {items}
      </div>
      <div style={{ width: NEUTRAL_W, display: "grid", placeItems: "center", borderLeft: HAIR, height: "100%" }}>{neutral}</div>
    </>
  );
}

function PlayerRow({ p, accent }: { p: BoardPlayer; accent: string }) {
  return (
    <div style={{ height: ROW_H, display: "flex", alignItems: "center", borderTop: "1px solid rgba(255,255,255,.06)" }}>
      {/* identity: позиция · портрет героя · ник */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 14, paddingLeft: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            background: accent,
            color: "#fff",
            font: `800 16px/1 ${FONT}`,
            flexShrink: 0,
          }}
        >
          {p.pos}
        </div>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Icon kind="heroes" slug={p.heroSlug} name={p.heroName} w={116} h={65} radius={6} />
          <div
            style={{
              position: "absolute",
              bottom: 3,
              left: 3,
              minWidth: 20,
              height: 20,
              padding: "0 5px",
              borderRadius: 5,
              display: "grid",
              placeItems: "center",
              background: "#0b0413",
              border: "1px solid rgba(255,255,255,.25)",
              color: "#fbbf24",
              font: `700 12px/1 ${FONT}`,
            }}
          >
            {p.level}
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: "#fff",
              font: `700 25px/1.1 ${FONT}`,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {p.nick}
          </div>
          {p.role && (
            <div style={{ color: "rgba(255,255,255,.5)", font: `600 14px/1.2 ${FONT}`, textTransform: "uppercase", letterSpacing: 1 }}>
              {p.role}
            </div>
          )}
        </div>
      </div>

      <StatCols
        kda={
          <div style={{ font: `800 23px/1 ${FONT}`, letterSpacing: 1 }}>
            <span style={{ color: "#6ee7a8" }}>{p.kills}</span>
            <span style={{ color: "rgba(255,255,255,.4)" }}> / </span>
            <span style={{ color: "#ff8a8a" }}>{p.deaths}</span>
            <span style={{ color: "rgba(255,255,255,.4)" }}> / </span>
            <span style={{ color: "#c4a6ff" }}>{p.assists}</span>
          </div>
        }
        dmg={<div style={{ color: "#fff", font: `800 24px/1 ${FONT}` }}>{num(p.heroDamage)}</div>}
        items={<Items p={p} />}
        neutral={<Icon kind="items" slug={p.neutral?.slug ?? ""} name={p.neutral?.name ?? ""} w={42} h={42} round />}
      />
    </div>
  );
}

function TeamPanel({ team, top }: { team: BoardTeam; top: number }) {
  const accent = team.color || DEFAULT_ACCENT;
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 40,
        right: 40,
        height: PANEL_H,
        borderRadius: 14,
        overflow: "hidden",
        background: "rgba(10,5,20,.72)",
        border: `2px solid ${accent}`,
        boxShadow: `0 0 60px ${accent}33`,
      }}
    >
      {/* шапка блока: колонки те же, что у строк (общий StatCols) — подписи ровно над данными.
          Бейдж WINNER/LOSER вынесен из потока (absolute), иначе он сдвигал бы колонки шапки. */}
      <div
        style={{
          height: HEAD_H,
          display: "flex",
          alignItems: "center",
          background: `linear-gradient(90deg, ${accent}44, ${accent}11 60%, transparent)`,
          borderBottom: `1px solid ${accent}66`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 16, paddingLeft: 24 }}>
          {team.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo} alt="" style={{ width: 54, height: 54, objectFit: "contain" }} />
          ) : null}
          <span
            style={{
              color: "#fff",
              font: `900 34px/1 ${FONT}`,
              textTransform: "uppercase",
              letterSpacing: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {team.name}
          </span>
        </div>
        <StatCols
          kda={<span style={{ color: "rgba(255,255,255,.55)", font: `700 15px/1 ${FONT}`, letterSpacing: 2 }}>K / D / A</span>}
          dmg={<span style={{ color: "rgba(255,255,255,.55)", font: `700 15px/1 ${FONT}`, letterSpacing: 2 }}>HERO DMG</span>}
          items={null}
          neutral={null}
        />
      </div>

      {/* бейдж исхода поверх правого края шапки — не влияет на раскладку колонок */}
      <span
        style={{
          position: "absolute",
          top: (HEAD_H - 34) / 2,
          right: 16,
          padding: "8px 16px",
          borderRadius: 6,
          font: `800 16px/1 ${FONT}`,
          letterSpacing: 1,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          ...(team.won
            ? { background: accent, color: "#fff" }
            : { border: "1px solid rgba(255,255,255,.35)", color: "rgba(255,255,255,.7)", background: "rgba(10,5,20,.7)" }),
        }}
      >
        {team.won ? "Winner" : "Loser"}
      </span>

      {team.players.map((p, i) => (
        <PlayerRow key={i} p={p} accent={accent} />
      ))}
    </div>
  );
}

function Render({ data }: { data: Data }) {
  const board = asBoard(data.match);
  const title = asText(data.title);

  const topY = 70;
  const gap = 34;

  return (
    <Bg templateId="postgame-board" w={W} h={H}>
      {title && (
        <div
          style={{
            position: "absolute",
            top: 18,
            left: 0,
            right: 0,
            textAlign: "center",
            color: "rgba(255,255,255,.85)",
            font: `800 30px/1 ${FONT}`,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
      )}

      {board ? (
        <>
          <TeamPanel team={board.teamTop} top={topY} />
          {/* перегородка между блоками команд */}
          <div
            style={{
              position: "absolute",
              top: topY + PANEL_H + gap / 2 - 1,
              left: 120,
              right: 120,
              height: 2,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent)",
            }}
          />
          <TeamPanel team={board.teamBottom} top={topY + PANEL_H + gap} />
        </>
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,.5)", font: `600 32px/1 ${FONT}` }}>
          Выберите матч
        </div>
      )}
    </Bg>
  );
}

export const postgameBoard: TemplateDef = {
  id: "postgame-board",
  title: "Скорборд карты (пост-гейм)",
  description: "Итог карты по игрокам: герои, K/D/A, урон и предметы обеих команд. Автозаполнение из матча. 1920×1080.",
  size: { w: W, h: H },
  fields: [
    { kind: "text", key: "title", label: "Заголовок", placeholder: "LOST · Division 1" },
    { kind: "match", key: "match", label: "Матч (карта)" },
  ],
  Render,
};
