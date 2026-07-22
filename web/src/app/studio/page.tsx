import Link from "next/link";
import { TEMPLATES } from "@/studio/registry";
import { prisma } from "@/lib/prisma";

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
        <h1 className="text-2xl font-bold tracking-tight">Шаблоны</h1>
        <p className="mt-1 text-sm text-neutral-500">
          В базе {teams} команд(ы) и {players} игрок(ов). Профили — во вкладках сверху.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/studio/new/${t.id}`}
            className="rounded border border-neutral-800 bg-neutral-900/40 p-5 hover:border-violet-600"
          >
            <div className="text-lg font-semibold">{t.title}</div>
            <div className="mt-1 text-sm text-neutral-400">{t.description}</div>
            <div className="mt-3 text-xs uppercase tracking-widest text-neutral-600">
              {t.size.w}×{t.size.h}
            </div>
          </Link>
        ))}
      </div>

      {renders.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm uppercase tracking-widest text-neutral-500">История</h2>
          <ul className="space-y-2 text-sm">
            {renders.map((r) => (
              <li key={r.id}>
                <Link href={`/studio/new/${r.templateId}?render=${r.id}`} className="text-violet-400 hover:underline">
                  {r.title ?? r.templateId}
                </Link>
                <span className="ml-2 text-xs text-neutral-600">
                  {r.createdAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
