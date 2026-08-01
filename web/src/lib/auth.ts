// Только сервер: простая защита админки — один пароль на всех, кука с подписью.
//
// Зачем так. Админ у лиги один (см. ARCHITECTURE, «Админка»), заводить таблицу пользователей,
// хеши и сброс пароля ради него — лишняя машинерия. Пароль лежит в `web/.env` (в `.gitignore`),
// в браузер он не уходит: наружу отдаётся только подписанный токен с сроком годности.
//
// Ключ подписи выводится из самого пароля. Побочный эффект намеренный: сменил пароль в .env —
// все выданные куки разом стали недействительны, отдельного «разлогинить всех» не нужно.

import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "lost_admin";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней: админку открывают редко, но подолгу

const password = () => process.env.ADMIN_PASSWORD ?? "";

/** Задан ли вообще пароль. Не задан — админка закрыта наглухо, а не открыта всем. */
export const adminConfigured = () => password().length > 0;

const sign = (exp: number) => createHmac("sha256", password()).update(`lost-admin|${exp}`).digest("hex");

/** Сравнение фиксированной длины: хеши вместо самих строк, чтобы не мерить время посимвольно. */
function sameSecret(a: string, b: string): boolean {
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Пароль из формы совпал с тем, что в .env. */
export function passwordOk(input: string): boolean {
  return adminConfigured() && sameSecret(input, password());
}

/** Значение куки: срок годности + подпись. Содержимого, которое стоило бы прятать, в ней нет. */
export function issueToken(): string {
  const exp = Date.now() + TTL_MS;
  return `${exp}.${sign(exp)}`;
}

/** Кука валидна: подпись сходится и срок не вышел. */
export function verifyToken(token: string | undefined): boolean {
  if (!adminConfigured() || !token) return false;
  const [rawExp, sig] = token.split(".");
  const exp = Number(rawExp);
  if (!Number.isFinite(exp) || !sig || exp < Date.now()) return false;
  return sameSecret(sig, sign(exp));
}

// --- Что вообще закрываем ---
//
// Правило: **закрыто всё, что пишет** — плюс разбор матча, который переехал в операторскую.
// Читать лигу можно без пароля: публичная таблица и ростер открыты, их и встраивают в лендинг.

/** Страницы служебной части: существуют только чтобы что-то менять или тратить деньги. */
const PROTECTED_PAGES = [
  "/studio", // генерация картинок через OpenAI — платная, чужим тут делать нечего
  "/admin", // вход, правка ростера — всё, что живёт в группе (admin)
  "/underbeer", // сборка шоу-команд — операторский инструмент эфира (публичен только /overlay/*)
  "/match", // разбор матча — операторский инструмент, убран с лендинга и закрыт паролем
];

/** Нужен ли пароль для этого запроса. Одно место правды — зовётся и из proxy, и из роутов. */
export function needsAdmin(pathname: string, method: string): boolean {
  if (pathname.startsWith("/admin/login")) return false; // иначе войти было бы некуда

  // Единственное исключение из «читать можно всем»: полка выгруженных постгеймов — черновики
  // оператора, а не факт о лиге. Прятать её в интерфейсе и раздавать списком через API — половина работы.
  if (pathname.startsWith("/api/postgame/archive")) return true;

  // Любая запись через API: POST/PATCH/PUT/DELETE. Чтение (GET) остаётся публичным.
  if (pathname.startsWith("/api/")) return method !== "GET" && method !== "HEAD";

  // Прежде здесь было отдельное правило `endsWith("/edit")`: формы правки жили вперемешку
  // с витринами ростера. Теперь они переехали под /admin/roster/*, и хватает префикса —
  // граница «читают/пишут» видна прямо в адресе, а не только в этом файле.
  return PROTECTED_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
