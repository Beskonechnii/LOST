import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Eyebrow } from "@/app/_components/ui";
import { CreateDesign } from "./_components/create-design";
import { DeleteDesign } from "./_components/delete-design";
import { GraphicsShelf } from "./_components/graphics-shelf";

export const dynamic = "force-dynamic";

// Список документов редактора + создание нового. Редактор — свободная расстановка элементов
// (в отличие от шаблонов «Студии», где вёрстка захардкожена), документы хранятся в модели Design.

type DesignRow = { id: number; title: string | null; updatedAt: Date; kind: string | null; seriesId: number | null };

const KIND_LABEL: Record<string, string> = { announce: "Анонс", announce2: "Анонс 2", score: "Счёт", result: "Итог" };

export default async function EditorHome() {
  const designs = await prisma.design.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, title: true, updatedAt: true, kind: true, seriesId: true },
  });

  // Три полки: мастер-шаблоны (kind без серии — их нельзя удалять случайно), графика серий
  // (клоны мастеров под конкретную серию) и обычные свободные документы.
  const masters = designs.filter((d) => d.kind && d.seriesId == null);
  const graphics = designs.filter((d) => d.seriesId != null);
  const docs = designs.filter((d) => !d.kind && d.seriesId == null);

  return (
    <div className="space-y-8">
      <div>
        <Eyebrow className="mb-2">Служебная часть · графика</Eyebrow>
        <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">Редактор</h1>
        <p className="mt-1.5 text-sm text-ink-subtle">
          Свободный холст: текст, фигуры и картинки из медиатеки расставляются вручную. Экспорт — PNG в натуральном размере.
        </p>
      </div>

      {/* Мастер-шаблоны отдельно и сверху: из них собирается графика серий, поэтому удалять их нельзя */}
      <Section
        title="Мастер-шаблоны"
        hint="Эталоны графики: из них кнопки в архиве серий собирают анонсы/счёт/итог. Удалять нельзя — правьте раскладку."
        rows={masters}
        locked
        empty="Мастеров пока нет. Пометьте документ полем kind, чтобы он стал шаблоном."
      />

      <GraphicsShelf
        rows={graphics.map((d) => ({
          id: d.id,
          title: d.title,
          kind: d.kind,
          updated: d.updatedAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }),
        }))}
      />

      <div>
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">Создать документ</div>
        <CreateDesign />
      </div>

      <Section title="Документы" rows={docs} empty="Свободных документов нет — создайте первый выше." />
    </div>
  );
}

function Section({
  title,
  hint,
  rows,
  locked,
  empty,
}: {
  title: string;
  hint?: string;
  rows: DesignRow[];
  locked?: boolean;
  empty: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">{title}</span>
        <span className="text-xs text-ink-subtle">{rows.length}</span>
      </div>
      {hint && <p className="mb-3 text-xs text-ink-subtle">{hint}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-ink-subtle">{empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((d) => (
            <div key={d.id} className="relative">
              <Link
                href={`/studio/editor/${d.id}`}
                className={`block rounded-xl border p-4 transition hover:-translate-y-0.5 hover:bg-surface-2 ${
                  locked
                    ? "border-accent/40 bg-accent/5 hover:border-accent/60"
                    : "border-hairline bg-surface-1 hover:border-accent/50"
                } ${locked ? "" : "pr-12"}`}
              >
                <div className="flex items-center gap-2">
                  {(locked || d.kind) && (
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-ink-muted">
                      {locked ? "мастер" : KIND_LABEL[d.kind ?? ""] ?? d.kind}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{d.title || `Документ #${d.id}`}</span>
                </div>
                <div className="mt-1 text-xs text-ink-subtle">
                  изменён {d.updatedAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                </div>
              </Link>
              {!locked && (
                <div className="absolute right-2 top-2">
                  <DeleteDesign id={d.id} title={d.title || `Документ #${d.id}`} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
