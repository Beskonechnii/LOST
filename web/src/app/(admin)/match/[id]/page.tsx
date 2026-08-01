import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin-session";
import { MatchReportView } from "../_components/report";

// Постоянная ссылка на отчёт. Сам матч грузится на клиенте (те же /api/<src>/match/<id>),
// поэтому страница остаётся тонкой: её дело — проверить id, узнать оператора и отдать вид.
// Кэш и лимит по IP живут на уровне API — см. lib/match-api.ts.

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Матч #${id}`,
    description: `Постгейм-отчёт по матчу Dota 2 #${id}: скорборд, драфт, таланты и предметы.`,
  };
}

export default async function MatchReportPage({ params }: Props) {
  const { id } = await params;
  // id матча у Valve — только цифры. Всё остальное — не «пустой отчёт», а несуществующий адрес.
  if (!/^\d+$/.test(id)) notFound();

  const admin = await isAdmin();

  return (
    // useSearchParams внутри требует границы Suspense — иначе Next не отдаст оболочку страницы.
    // key по id: переход на другой матч сбрасывает ручные правки названий, они относились к прошлому.
    <Suspense fallback={<p className="p-8 text-sm text-ink-subtle">Загружаю матч #{id}…</p>}>
      <MatchReportView key={id} matchId={id} canArchive={admin} />
    </Suspense>
  );
}
