import Link from "next/link";
import { TEMPLATES } from "@/studio/registry";
import { prisma } from "@/lib/prisma";
import { RenderHistory } from "./_components/render-history";

export const dynamic = "force-dynamic";

export default async function StudioHome() {
  const [teams, players, renders] = await Promise.all([
    prisma.team.count(),
    prisma.player.count(),
    prisma.render.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Студия</h1>
        <p className="mt-1 text-sm text-ink-subtle">
          Графика собирается по данным ростера: {teams} команд(ы) и {players} игрок(ов). Лого, фото и составы правятся в{" "}
          <Link href="/roster/teams" className="text-accent-bright hover:underline">
            разделе «Ростер»
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/studio/new/${t.id}`}
            className="rounded border border-hairline bg-surface-1/40 p-5 hover:border-accent"
          >
            <div className="text-lg font-semibold">{t.title}</div>
            <div className="mt-1 text-sm text-ink-muted">{t.description}</div>
            <div className="mt-3 text-xs uppercase tracking-widest text-ink-subtle">
              {t.size.w}×{t.size.h}
            </div>
          </Link>
        ))}
      </div>

      <RenderHistory
        renders={renders.map((r) => ({
          id: r.id,
          templateId: r.templateId,
          title: r.title,
          created: r.createdAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }),
        }))}
      />
    </div>
  );
}
