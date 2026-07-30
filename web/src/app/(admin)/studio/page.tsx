import Link from "next/link";
import { TEMPLATES } from "@/studio/registry";
import { prisma } from "@/lib/prisma";
import { Eyebrow } from "@/app/_components/ui";
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
        <Eyebrow className="mb-2">Служебная часть · графика</Eyebrow>
        <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">Студия</h1>
        <p className="mt-1.5 text-sm text-ink-subtle">
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
            className="rounded-2xl border border-hairline bg-surface-1 p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_14px_40px_-26px_rgba(0,0,0,0.9)] transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-2"
          >
            <div className="text-lg font-semibold text-ink">{t.title}</div>
            <div className="mt-1 text-sm text-ink-muted">{t.description}</div>
            <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
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
