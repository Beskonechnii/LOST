import type { Data, ResolvedRow, TemplateDef } from "../types";
import { asRows, asTeam, asText } from "../types";
import { Bg } from "./parts";

// Итоги игрового дня, 1080×1920 (референс: MATCH DAY, до трёх матчей, WINNER и MVP).
// Блок матча повторяется — это поле kind: "group".

const W = 1080;
const H = 1920;
const TOP = 300; // под заголовком
const GAP = 40;

function TeamMark({ logo, name, accent }: { logo: string | null; name: string; accent: string }) {
  return (
    <div style={{ width: 260, height: 260, display: "grid", placeItems: "center" }}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" style={{ maxWidth: 240, maxHeight: 240, objectFit: "contain", filter: `drop-shadow(0 0 40px ${accent}88)` }} />
      ) : (
        <span
          style={{
            color: "#c4a6ff",
            font: "800 44px/1.1 var(--studio-font, system-ui)",
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          {name || "TEAM"}
        </span>
      )}
    </div>
  );
}

function WinnerStamp() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: -6,
        left: "50%",
        transform: "translateX(-50%) skewX(-8deg)",
        color: "#fff",
        font: "900 56px/1 var(--studio-font, system-ui)",
        letterSpacing: 2,
        textShadow: "0 0 30px rgba(168,85,247,.8)",
      }}
    >
      WINNER
    </div>
  );
}

function MatchRow({ row, top, height }: { row: ResolvedRow; top: number; height: number }) {
  const a = asTeam(row.teamA);
  const b = asTeam(row.teamB);
  const scoreA = asText(row.scoreA) || "0";
  const scoreB = asText(row.scoreB) || "0";
  const division = asText(row.division);
  const mvp = asText(row.mvp);
  const winner = Number(scoreA) === Number(scoreB) ? null : Number(scoreA) > Number(scoreB) ? "A" : "B";

  return (
    <div style={{ position: "absolute", top, left: 60, right: 60, height }}>
      {division && (
        <div
          style={{
            textAlign: "center",
            color: "#e9d5ff",
            font: "800 34px/1 var(--studio-font, system-ui)",
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          {division}
        </div>
      )}

      <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ position: "relative" }}>
          <TeamMark logo={a?.logo ?? null} name={a?.name ?? ""} accent={a?.color ?? "#a855f7"} />
          {winner === "A" && <WinnerStamp />}
        </div>

        <div style={{ color: "#fff", font: "800 110px/1 var(--studio-font, system-ui)", letterSpacing: 4 }}>
          {scoreA}:{scoreB}
        </div>

        <div style={{ position: "relative" }}>
          <TeamMark logo={b?.logo ?? null} name={b?.name ?? ""} accent={b?.color ?? "#a855f7"} />
          {winner === "B" && <WinnerStamp />}
        </div>
      </div>

      {mvp && (
        <div style={{ marginTop: 22, textAlign: "center" }}>
          <span
            style={{
              display: "inline-block",
              padding: "8px 26px",
              borderRadius: 8,
              border: "2px solid #7c3aed",
              background: "#160a27",
              color: "#fff",
              font: "600 30px/1 var(--studio-font, system-ui)",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            MVP — {mvp}
          </span>
        </div>
      )}
    </div>
  );
}

function Render({ data }: { data: Data }) {
  const title = asText(data.title) || "MATCH DAY";
  const rows = asRows(data.matches).slice(0, 3);
  const height = rows.length ? (H - TOP - 260 - GAP * (rows.length - 1)) / rows.length : 0;

  return (
    <Bg templateId="match-day" w={W} h={H}>
      <div
        style={{
          position: "absolute",
          top: 90,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#fff",
          font: "800 96px/1 var(--studio-font, system-ui)",
          letterSpacing: 4,
          textTransform: "uppercase",
          textShadow: "0 0 50px rgba(168,85,247,.6)",
        }}
      >
        {title}
      </div>

      {rows.map((row, i) => (
        <MatchRow key={i} row={row} top={TOP + i * (height + GAP)} height={height} />
      ))}
    </Bg>
  );
}

export const matchDay: TemplateDef = {
  id: "match-day",
  title: "Итоги дня (MATCH DAY)",
  description: "Вертикальный сторис: до трёх матчей со счётом, победителем и MVP. 1080×1920.",
  size: { w: W, h: H },
  fields: [
    { kind: "text", key: "title", label: "Заголовок", default: "MATCH DAY" },
    {
      kind: "group",
      key: "matches",
      label: "Матчи",
      max: 3,
      fields: [
        { kind: "text", key: "division", label: "Дивизион", placeholder: "Division 1" },
        { kind: "team", key: "teamA", label: "Команда слева" },
        { kind: "text", key: "scoreA", label: "Счёт слева", default: "0" },
        { kind: "team", key: "teamB", label: "Команда справа" },
        { kind: "text", key: "scoreB", label: "Счёт справа", default: "0" },
        { kind: "text", key: "mvp", label: "MVP", placeholder: "CHIPOLLINO" },
      ],
    },
  ],
  Render,
};
