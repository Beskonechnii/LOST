import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Eyebrow } from "@/app/_components/ui";
import { CreateDesign } from "./_components/create-design";
import { DeleteDesign } from "./_components/delete-design";

export const dynamic = "force-dynamic";

// Список документов редактора + создание нового. Редактор — свободная расстановка элементов
// (в отличие от шаблонов «Студии», где вёрстка захардкожена), документы хранятся в модели Design.

export default async function EditorHome() {
  const designs = await prisma.design.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true },
  });

  return (
    <div className="space-y-8">
      <div>
        <Eyebrow className="mb-2">Служебная часть · графика</Eyebrow>
        <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">Редактор</h1>
        <p className="mt-1.5 text-sm text-ink-subtle">
          Свободный холст: текст, фигуры и картинки из медиатеки расставляются вручную. Экспорт — PNG в натуральном размере.
        </p>
      </div>

      <div>
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">Создать документ</div>
        <CreateDesign />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {designs.map((d) => (
          <div key={d.id} className="relative">
            <Link
              href={`/studio/editor/${d.id}`}
              className="block rounded-xl border border-hairline bg-surface-1 p-4 pr-12 transition hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-2"
            >
              <div className="font-semibold text-ink">{d.title || `Документ #${d.id}`}</div>
              <div className="mt-1 text-xs text-ink-subtle">
                изменён {d.updatedAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
              </div>
            </Link>
            <div className="absolute right-2 top-2">
              <DeleteDesign id={d.id} title={d.title || `Документ #${d.id}`} />
            </div>
          </div>
        ))}
        {designs.length === 0 && <p className="text-sm text-ink-subtle">Пока нет документов — создайте первый выше.</p>}
      </div>
    </div>
  );
}
