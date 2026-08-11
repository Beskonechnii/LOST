import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Eyebrow } from "@/app/_components/ui";
import { NewFearlessButton } from "./_components/new-fearless-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fearless draft" };

// Архив fearless-серий: список сессий + кнопка новой. Сам борд — на /admin/fearless-draft/[id].
// Как UNDERBEER: сессия эфемерная, состояние в payload (не в снимке БД).

export default async function FearlessHome() {
  const sessions = await prisma.fearlessSession.findMany({ orderBy: { updatedAt: "desc" }, take: 50 });

  return (
    <main className="mx-auto w-full max-w-[100rem] flex-1 px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow className="mb-2">Служебная часть · fearless</Eyebrow>
          <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">Fearless draft</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-subtle">
            Драфт героев без повторов по серии: рандом-пул 9/атрибут, монетка, баны и пики с таймерами.
          </p>
        </div>
        <NewFearlessButton />
      </div>

      <div className="mt-8 space-y-2">
        {sessions.length === 0 && <p className="text-sm text-ink-subtle">Пока нет сохранённых драфтов. Создай новый.</p>}
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={`/admin/fearless-draft/${s.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 p-4 transition hover:border-accent/50 hover:bg-surface-2"
          >
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{s.title || `Драфт #${s.id}`}</div>
              <div className="text-xs text-ink-subtle">
                обновлён {s.updatedAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${s.status === "done" ? "bg-emerald-500/15 text-emerald-400" : "bg-surface-2 text-ink-muted"}`}>
              {s.status === "done" ? "готов" : "черновик"}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
