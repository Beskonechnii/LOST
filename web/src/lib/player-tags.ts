// Плашки роли игрока в лиге — не путать с игровой ролью в составе (roles.ts, поз. 1–5).
// Здесь про то, кем человек является для лиги: игрок, стример, кастер, партнёр, организатор.
// У одного человека их может быть несколько (играет и кастует) — поэтому в БД хранится список
// ключей через запятую в Player.tags. Порядок массива = порядок вывода бейджей.
//
// Без БД, чистые данные — годится и на клиенте (как roles.ts / divisions.ts).

export type PlayerTag = { key: string; label: string };

export const PLAYER_TAGS: PlayerTag[] = [
  { key: "player", label: "Игрок" },
  { key: "captain", label: "Капитан" },
  { key: "streamer", label: "Стример" },
  { key: "caster", label: "Кастер" },
  { key: "analyst", label: "Аналитик" },
  { key: "coach", label: "Тренер" },
  { key: "partner", label: "Партнёр" },
  { key: "organizer", label: "Организатор" },
];

const byKey = new Map(PLAYER_TAGS.map((t) => [t.key, t]));

/** Строка «player,caster» из БД → список ключей без мусора и дублей, в порядке справочника. */
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const set = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => byKey.has(s)),
  );
  return PLAYER_TAGS.filter((t) => set.has(t.key)).map((t) => t.key);
}

/** Ключ → подпись бейджа; неизвестный ключ отбрасывается на этапе parseTags. */
export const tagLabel = (key: string): string => byKey.get(key)?.label ?? key;
