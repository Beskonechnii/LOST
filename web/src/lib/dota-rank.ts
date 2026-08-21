// Ранг Доты: rank_tier OpenDota → человеческая подпись. Чистый модуль — годится и на клиенте.
//
// Формат Valve: десятки — медаль (1 Рекрут … 7 Божество), единицы — звезда 1–5. 80 и выше —
// Immortal, у него звёзд нет, зато бывает место в лидерборде.

const MEDALS = ["Рекрут", "Страж", "Рыцарь", "Герой", "Легенда", "Властелин", "Божество"];

/** «55» → «Властелин 5»; «80» → «Иммортал»; мусор и 0 → null (ранга просто нет). */
export function rankLabel(tier: number | null | undefined): string | null {
  if (!tier || tier < 10) return null;
  if (tier >= 80) return "Иммортал";
  const medal = MEDALS[Math.floor(tier / 10) - 1];
  if (!medal) return null;
  const star = tier % 10;
  return star ? `${medal} ${star}` : medal;
}
