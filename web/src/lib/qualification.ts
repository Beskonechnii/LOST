// Зоны выхода из группы: чистые правила и цвета, без обращений к БД.
// Отдельно от group-stage.ts намеренно — тот тянет Prisma, а это нужно и клиентским компонентам
// (сетка групп). Та же развилка, что у openai-images.ts (сервер) и image-options.ts (данные).

/** Куда команда уходит из группы. Порядок и цвета одинаковы везде, где показываем группу. */
export type Qualification = "upper" | "lower" | "out";

export const QUALIFICATION: Record<Qualification, { label: string; text: string; marker: string }> = {
  upper: { label: "Верхняя сетка", text: "text-emerald-400", marker: "bg-emerald-500" },
  lower: { label: "Нижняя сетка", text: "text-amber-400", marker: "bg-amber-500" },
  out: { label: "Вылет", text: "text-rose-400", marker: "bg-rose-500" },
};

/**
 * Регламент отличается по дивизионам:
 *  - Division 1 (8 команд в группе): 1–4 — верхняя, 5–6 — нижняя, два последних вылетают.
 *  - Division 2 (6 команд в группе): 1–4 — верхняя, все остальные — нижняя, вылета из группы нет.
 * Дивизион — имя из Team.group ("Division 1"/"Division 2"), как в divisions.ts.
 * Считаем от низа, а не по фиксированным местам: в группе может быть не восемь команд.
 */
export function qualificationOf(place: number, groupSize: number, division: string): Qualification {
  if (place <= 4) return "upper";
  // В D2 нижние команды не вылетают, а падают в нижнюю сетку.
  if (division === "Division 2") return "lower";
  return place > groupSize - 2 ? "out" : "lower";
}

/**
 * Очки за серию Bo3. Формула выведена из таблицы сезона и сошлась на всех командах группы A
 * первого дивизиона (ГУЗЛИКИ 15, Ethereal 15, 5KN 2), поэтому считаем её правилом лиги:
 * 2:0 → 3, 2:1 → 2, 1:2 → 1, 0:2 → 0. Идея — «сухая» победа дороже, а взятая карта не пропадает.
 */
export function seriesPoints(own: number, opp: number) {
  if (own > opp) return opp === 0 ? 3 : 2;
  return own === 0 ? 0 : 1;
}
