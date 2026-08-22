// Только сервер: сезонный зачёт TP (очки MVP).
//
// Зачёт **турнирный**: в новом сезоне счёт начинается заново, а история прошлых не теряется.
// Поэтому истина — реестр `PointsEntry` (reason="tp", `tournamentId`), а `Player.tp` остался
// кешем «за всё время»: его читают витрины, которым нужна одна цифра (карточка игрока, студия),
// и пересчитывать сумму в каждой такой выборке ради этого незачем.
//
// Реестр же, в отличие от одного поля, отвечает на вопрос «за что и когда» — ровно то, чего не
// хватало, когда TP правились числом в поле.

import { prisma } from "./prisma";
import { currentTournament } from "./tournaments";

export const TP_REASON = "tp";

/** Начисления TP игрокам за турнир: playerId → сумма. Турнир не задан — за всё время. */
export async function tpByTournament(tournamentId?: number | null): Promise<Map<number, number>> {
  // Суммируем в памяти, а не groupBy: строк реестра сотни, зато ветка одна и на sqlite,
  // и на любом другом драйвере — нам здесь нечего оптимизировать.
  const rows = await prisma.pointsEntry.findMany({
    where: { subjectType: "player", reason: TP_REASON, ...(tournamentId ? { tournamentId } : {}) },
    select: { subjectId: true, amount: true },
  });
  const totals = new Map<number, number>();
  for (const r of rows) totals.set(r.subjectId, (totals.get(r.subjectId) ?? 0) + r.amount);
  return totals;
}

/** История начислений игрока — что и за какой турнир. Для карточки игрока и разбора спорных мест. */
export const tpHistory = (playerId: number) =>
  prisma.pointsEntry.findMany({
    where: { subjectType: "player", reason: TP_REASON, subjectId: playerId },
    orderBy: { createdAt: "desc" },
    include: { tournament: true },
  });

/**
 * Поставить игроку итог за турнир. Пишем не «новое значение», а **разницу** отдельной строкой
 * реестра: корректировка — это новая запись, а не правка старой (так задуман `PointsEntry`).
 * Ноль-разницу не пишем, чтобы повторное сохранение той же цифры не плодило пустые строки.
 *
 * `Player.tp` после записи пересчитывается из реестра — кеш не должен расходиться с истиной.
 */
export async function setPlayerTp(playerId: number, total: number, opts: { tournamentId?: number | null; note?: string | null; by?: string | null } = {}) {
  const tournamentId = opts.tournamentId === undefined ? (await currentTournament())?.id ?? null : opts.tournamentId;

  const current = await prisma.pointsEntry.aggregate({
    where: { subjectType: "player", reason: TP_REASON, subjectId: playerId, tournamentId },
    _sum: { amount: true },
  });
  const delta = total - (current._sum.amount ?? 0);

  if (delta !== 0) {
    await prisma.pointsEntry.create({
      data: {
        subjectType: "player",
        subjectId: playerId,
        reason: TP_REASON,
        amount: delta,
        tournamentId,
        note: opts.note ?? null,
        createdBy: opts.by ?? null,
      },
    });
  }

  const all = await prisma.pointsEntry.aggregate({
    where: { subjectType: "player", reason: TP_REASON, subjectId: playerId },
    _sum: { amount: true },
  });
  return prisma.player.update({ where: { id: playerId }, data: { tp: all._sum.amount ?? 0 } });
}
