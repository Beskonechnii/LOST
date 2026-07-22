import type { Data, TemplateDef } from "../types";
import { asTeam, asText } from "../types";
import { Bg, TeamPhoto, Wordmark } from "./parts";

// Анонс матча, 1920×1080 (референс: PLAY-OFF, MOLOKO vs MORBUS MENTIS, bo3, 20:30).
// Фон целиком — /public/templates/vs-announce/bg.png (экспорт из Figma), здесь только слои поверх.

const W = 1920;
const H = 1080;

function Side({ data, side }: { data: Data; side: "A" | "B" }) {
  const team = asTeam(data[`team${side}`]);
  const left = side === "A";

  return (
    <div
      style={{
        position: "absolute",
        top: 96,
        [left ? "left" : "right"]: 130,
        width: 640,
        height: 860,
        display: "flex",
        flexDirection: "column",
        alignItems: left ? "flex-start" : "flex-end",
      }}
    >
      {/* плашка с тегом/названием над фото */}
      <div
        style={{
          alignSelf: "center",
          padding: "6px 28px",
          borderRadius: 6,
          background: "#12071f",
          border: `2px solid ${team?.color ?? "#a855f7"}`,
          color: "#fff",
          font: "700 26px/1 var(--studio-font, system-ui)",
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        {team?.name ?? "КОМАНДА"}
      </div>

      <TeamPhoto src={team?.photo ?? null} accent={team?.color ?? "#a855f7"} width={620} height={560} />

      <div style={{ marginTop: 24, width: "100%", display: "flex", justifyContent: left ? "flex-start" : "flex-end" }}>
        <Wordmark src={team?.wordmark ?? null} logo={team?.logo ?? null} name={team?.name ?? ""} maxWidth={620} maxHeight={240} />
      </div>
    </div>
  );
}

function Render({ data }: { data: Data }) {
  const stage = asText(data.stage) || "PLAY-OFF";
  const format = asText(data.format) || "bo3";
  const time = asText(data.time) || "20:30";
  const division = asText(data.division);

  return (
    <Bg templateId="vs-announce" w={W} h={H}>
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#fff",
          font: "800 76px/1 var(--studio-font, system-ui)",
          letterSpacing: 6,
          textTransform: "uppercase",
          textShadow: "0 0 40px rgba(168,85,247,.6)",
        }}
      >
        {stage}
      </div>

      <Side data={data} side="A" />
      <Side data={data} side="B" />

      <div style={{ position: "absolute", left: 760, right: 760, top: 280, textAlign: "center" }}>
        <div style={{ color: "#cbb7f5", font: "600 40px/1 var(--studio-font, system-ui)", letterSpacing: 4 }}>{format}</div>
        <div
          style={{
            marginTop: 40,
            color: "#B4F23C",
            font: "900 190px/0.9 var(--studio-font, system-ui)",
            transform: "skewX(-8deg)",
            textShadow: "0 0 60px rgba(180,242,60,.35)",
          }}
        >
          VS
        </div>
        <div style={{ marginTop: 40, color: "#fff", font: "700 96px/1 var(--studio-font, system-ui)", letterSpacing: 4 }}>
          {time}
        </div>
      </div>

      {division && (
        <div
          style={{
            position: "absolute",
            left: 130,
            bottom: 38,
            color: "#e9d5ff",
            font: "700 28px/1 var(--studio-font, system-ui)",
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          {division}
        </div>
      )}
    </Bg>
  );
}

export const vsAnnounce: TemplateDef = {
  id: "vs-announce",
  title: "Анонс матча (VS)",
  description: "Горизонтальный анонс: две команды, формат серии, время. 1920×1080.",
  size: { w: W, h: H },
  fields: [
    { kind: "text", key: "stage", label: "Стадия", default: "PLAY-OFF" },
    { kind: "team", key: "teamA", label: "Команда слева" },
    { kind: "team", key: "teamB", label: "Команда справа" },
    { kind: "select", key: "format", label: "Формат", options: ["bo1", "bo2", "bo3", "bo5"], default: "bo3" },
    { kind: "text", key: "time", label: "Время", default: "20:30", placeholder: "20:30" },
    { kind: "text", key: "division", label: "Дивизион", placeholder: "Division 1" },
  ],
  Render,
};
