import { SectionHeader } from "@/app/_components/ui";

// Заглушка раздела в разработке. Место в навигации уже держится (см. ADMIN_SECTIONS в site-nav),
// а самого инструмента ещё нет — показываем честное «в стадии разработки», а не пустую страницу.
export function WorkInProgress({ title, note }: { title: string; note?: string }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">
      <SectionHeader
        eyebrow="Админка"
        title={title}
        aside={<span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-amber-300">в разработке</span>}
      />
      <div className="mt-8 rounded-2xl border border-dashed border-hairline-strong bg-surface-1 px-6 py-16 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-surface-2 text-2xl">🛠️</div>
        <p className="mt-4 text-lg font-semibold text-ink">Раздел в стадии разработки</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
          {note ?? "Инструмент ещё не готов. Место в навигации зарезервировано — вкладка появится здесь."}
        </p>
      </div>
    </main>
  );
}
