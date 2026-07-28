// Правила состава: кто где может стоять. Один источник для импорта из таблицы и для API ростера,
// чтобы правило не разъехалось между «залили скриптом» и «поправили руками в UI».

import { rolePosition } from "@/lib/roles";

/** Действующий игрок — тот, кто занимает позицию 1–5. Замена и тренер действующими не считаются. */
export const isCoreRole = (role: string | null | undefined) => rolePosition(role) !== null;

export type SpotLike = { teamId: number; role: string | null; division?: string | null };

/**
 * Можно ли отдать игроку это место. Жёсткий запрет — быть **действующим** (поз. 1–5) сразу в двух
 * командах **одного дивизиона**: внутри дивизиона он сыграет за одну, и стата с составами разъедется.
 * А вот в разных дивизионах (D1 и D2 — раздельные турниры) действующим быть можно: игрок нередко
 * заявлен и в первом, и во втором. Замена и тренер — сколько угодно раз в любом дивизионе.
 *
 * @param existing  места, которые у игрока уже есть (кроме того, что сейчас меняем); дивизион — из Team.group
 * @returns текст ошибки или null, если всё в порядке
 */
export function spotConflict(
  existing: (SpotLike & { teamName?: string })[],
  next: SpotLike,
): string | null {
  if (!isCoreRole(next.role)) return null;

  const nextDiv = next.division ?? null;
  const clash = existing.find(
    (s) => s.teamId !== next.teamId && isCoreRole(s.role) && (s.division ?? null) === nextDiv,
  );
  if (!clash) return null;

  return `игрок уже действующий в составе «${clash.teamName ?? `команда #${clash.teamId}`}» того же дивизиона — ` +
    `действующим можно быть только в одной команде дивизиона, во вторую ставьте заменой`;
}
