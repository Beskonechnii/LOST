import { prisma } from "@/lib/prisma";
import { NewDraftButton } from "./_components/new-draft-button";
import { DraftList } from "./_components/draft-list";

export const dynamic = "force-dynamic";

export default async function UnderbeerHome() {
  const [players, sessions] = await Promise.all([
    prisma.player.count(),
    prisma.draftSession.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
  ]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">UNDERBEER 2.0</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
            Сборка шоу-команд из живого ростера ({players} игрок(ов)). Назначь капитанов, задай размер состава —
            и капитаны по очереди драфтят игроков. У каждой команды по разу есть «Закрепить» и «Украсть».
          </p>
        </div>
        <NewDraftButton />
      </div>

      <DraftList
        sessions={sessions.map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          updated: s.updatedAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }),
        }))}
      />
    </div>
  );
}
