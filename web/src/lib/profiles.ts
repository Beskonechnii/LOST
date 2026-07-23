// Профили команд и игроков: слаги, пути к загруженным картинкам, внешние ссылки.
// Слаг — стабильный ключ: по нему идёт импорт составов и подбор файлов лого/фото.
// Картинки лежат локально в public/uploads (см. src/lib/assets.ts — та же стратегия для ассетов Dota).

export type UploadKind = "teams" | "players";

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya",
};

/** Название/ник → слаг: латиница, нижний регистр, дефисы. «300$» → "300", кириллица транслитом. */
export function slugify(input: string): string {
  const translit = [...input.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join("");
  return translit
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Тег команды для таблиц и графики. У части команд тега в таблице сезона нет, а колонка должна быть
 * заполнена всегда — поэтому выводим из названия: берём первое слово, латиницу/цифры, до 5 знаков.
 * Это фолбэк: как только тег заведут в ростере, он перекроет вычисленный.
 */
export function teamTag(team: { tag?: string | null; name: string }): string {
  const own = team.tag?.trim();
  if (own) return own;

  const word = team.name.trim().split(/\s+/)[0] ?? team.name;
  const clean = [...word].filter((ch) => /[\p{L}\p{N}]/u.test(ch)).join("");
  return (clean || team.name).slice(0, 5).toUpperCase();
}

/** Публичный путь к загруженной картинке профиля. Имя файла хранится в БД целиком. */
export function uploadUrl(kind: UploadKind, file: string): string {
  return `/uploads/${kind}/${file}`;
}

/** Ссылки на внешние профили: считаем из accountId, если в БД не задана своя. */
export const dotabuffOf = (accountId: string) => `https://www.dotabuff.com/players/${accountId}`;
export const stratzOf = (accountId: string) => `https://stratz.com/players/${accountId}`;
// steam64 = steam32 + константа Valve; 64-битная арифметика — только через BigInt (в Number не влезает).
export const steamOf = (accountId: string) =>
  `https://steamcommunity.com/profiles/${BigInt(accountId) + BigInt("76561197960265728")}`;

type PlayerLinksInput = {
  accountId?: string | null;
  steamUrl?: string | null;
  dotabuffUrl?: string | null;
  stratzUrl?: string | null;
};

/** Итоговые ссылки игрока: поля из БД перекрывают вывод из accountId. */
export function playerLinks(p: PlayerLinksInput) {
  const id = p.accountId?.trim();
  const derived = id && /^\d+$/.test(id);
  return {
    steam: p.steamUrl ?? (derived ? steamOf(id) : null),
    dotabuff: p.dotabuffUrl ?? (derived ? dotabuffOf(id) : null),
    stratz: p.stratzUrl ?? (derived ? stratzOf(id) : null),
  };
}
