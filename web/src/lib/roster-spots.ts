// Правила состава: кто где может стоять. Один источник для импорта из таблицы и для API ростера,
// чтобы правило не разъехалось между «залили скриптом» и «поправили руками в UI».

import { rolePosition } from "@/lib/roles";

/** Действующий игрок — тот, кто занимает позицию 1–5. Замена и тренер действующими не считаются. */
export const isCoreRole = (role: string | null | undefined) => rolePosition(role) !== null;

export type SpotLike = { teamId: number; role: string | null };

/**
 * Можно ли отдать игроку это место. Единственный жёсткий запрет — быть **действующим** (поз. 1–5)
 * сразу в двух командах: в матче он сыграет за одну, и вся стата с составами разъедется.
 * Замена и тренер сколько угодно раз: человек может страховать несколько команд.
 *
 * @param existing  места, которые у игрока уже есть (кроме того, что сейчас меняем)
 * @returns текст ошибки или null, если всё в порядке
 */
export function spotConflict(
  existing: (SpotLike & { teamName?: string })[],
  next: SpotLike,
): string | null {
  if (!isCoreRole(next.role)) return null;

  const clash = existing.find((s) => s.teamId !== next.teamId && isCoreRole(s.role));
  if (!clash) return null;

  return `игрок уже действующий в составе «${clash.teamName ?? `команда #${clash.teamId}`}» — ` +
    `действующим можно быть только в одной команде, во вторую ставьте заменой`;
}
