// Справочники для шаблонов: команды и игроки в форме, которую ждёт рендер (src/studio/types.ts),
// плюс список матчей для автозаполнения. Один источник и для мастера, и для /studio/render.

import { prisma } from "@/lib/prisma";
import { isCoreRole } from "@/lib/roster-spots";
import { withPlayerUploads, withTeamUploads } from "@/lib/uploads";
import type { MatchOption, PlayerRef, TeamRef } from "@/studio/types";
import type { Refs } from "@/studio/resolve";


export async function getRefs(): Promise<Refs> {
  const [teams, players] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.player.findMany({
      orderBy: { nickname: "asc" },
      include: { spots: { include: { team: { select: { name: true } } }, orderBy: { id: "asc" } } },
    }),
  ]);

  // Картинки — через фолбэк по слагу: шаблон должен собираться и на чистом клоне, где БД пустая.
  const teamRefs: TeamRef[] = await Promise.all(
    teams.map(async (t) => {
      const img = await withTeamUploads(t);
      return {
        id: t.id,
        name: t.name,
        tag: t.tag,
        group: t.group,
        color: t.color,
        logo: img.logo,
        wordmark: img.wordmark,
        photo: img.photo,
      };
    }),
  );
  const playerRefs: PlayerRef[] = await Promise.all(
    players.map(async (p) => ({
      id: p.id,
      nickname: p.nickname,
      photo: (await withPlayerUploads(p)).photo,
      // в подписи шаблона нужна одна команда — берём ту, где игрок действующий, иначе первую
      teamName: (p.spots.find((s) => isCoreRole(s.role)) ?? p.spots[0])?.team.name ?? null,
    })),
  );

  return { teams: teamRefs, players: playerRefs };
}

export async function getMatchOptions(): Promise<MatchOption[]> {
  const matches = await prisma.match.findMany({
    orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
    take: 30,
    include: { teamA: true, teamB: true },
  });

  return matches.map((m) => {
    const date = m.scheduledAt;
    return {
      id: m.id,
      label: `${m.teamA.name} — ${m.teamB.name}${date ? ` · ${date.toLocaleDateString("ru-RU")}` : ""}`,
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      time: date ? date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "",
      division: m.teamA.group ?? m.teamB.group ?? "",
    };
  });
}
