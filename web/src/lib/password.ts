// Чистая крипта пароля — без next/headers и без БД (как player-auth.ts). scrypt из node:crypto:
// свой хеш, без внешних зависимостей — в стиле проекта, где вся крипта самописная. Формат хранения
// `salt:hash` (обе половины hex): соль случайная на каждый пароль, сравнение — timing-safe.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64; // длина производного ключа в байтах

/** Хеш пароля для БД: `<salt hex>:<hash hex>`. Соль своя у каждого — одинаковые пароли дают разный хеш. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** Проверка пароля против хранимого хеша. false при любом расхождении формата/длины/значения. */
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== KEYLEN) return false;
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), KEYLEN);
  // Длины равны (обе KEYLEN) — timingSafeEqual не бросит; сравнение постоянного времени.
  return timingSafeEqual(actual, expected);
}

/** Требования к паролю. Одно место правды — зовут и регистрация, и смена/сброс. Null = ок. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Пароль должен быть не короче 8 символов";
  if (password.length > 200) return "Слишком длинный пароль";
  return null;
}
