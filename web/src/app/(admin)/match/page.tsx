import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin-session";
import { SITE_MAX_W } from "@/app/_components/ui";
import { ArchiveShelf } from "./_components/archive-shelf";
import { MatchForm } from "./_components/match-form";

// Входная дверь постгейма: ввод id матча. Сам отчёт — на /match/<id>, у него постоянная ссылка.
// Сервис публичный (решено с заказчиком): разбираем любой матч Dota 2, не только матчи лиги.

export const metadata: Metadata = {
  title: "Разбор матча",
  description: "Постгейм-отчёт по матчу Dota 2: скорборд, драфт, таланты, предметы и график преимущества.",
};

export default async function MatchPage() {
  const admin = await isAdmin();

  return (
    <main className="flex-1 p-4 md:p-8">
      <div className={`mx-auto ${SITE_MAX_W}`}>
        <h1 className="text-lg font-bold tracking-tight">Разбор матча Dota 2</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Вставь ID матча — соберём постгейм-отчёт: счёт, драфт, скорборд, таланты, предметы и график
          преимущества. Данные из OpenDota, а если она лежит — из Steam. У отчёта постоянная ссылка,
          ей можно поделиться.
        </p>

        <div className="mt-6">
          <MatchForm />
        </div>

        {/* Полка выгруженных PNG — черновики оператора, посетителю она ни о чём не говорит. */}
        {admin && (
          <div className="mt-8">
            <ArchiveShelf />
          </div>
        )}
      </div>
    </main>
  );
}
