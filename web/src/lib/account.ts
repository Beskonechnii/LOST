// Только сервер: операции над аккаунтами игроков поверх сессии (lib/player-auth.ts) и БД.
// Одно место правды для «кто вошёл», «завести профиль», «подать/подтвердить заявку» — чтобы
// правила привязки не разъезжались между страницей /me и админкой.

import "server-only";
import { prisma } from "./prisma";
import { currentAccountId, setSessionCookie } from "./player-session";
import type { Role } from "./player-auth";
import { slugify } from "./profiles";
import { hashPassword, verifyPassword, passwordProblem } from "./password";
import { issueToken, consumeToken } from "./auth-tokens";
import { sendVerifyEmail, sendResetEmail } from "./mailer";
import { appUrl } from "./app-url";

/** Аккаунт по id — вместе с привязанным профилем и заявкой (обе связи опциональны). */
export function loadAccount(id: number) {
  return prisma.userAccount.findUnique({ where: { id }, include: { player: true, claim: true } });
}

export type Account = NonNullable<Awaited<ReturnType<typeof loadAccount>>>;

/** Текущий вошедший игрок, либо null. Читает куку запроса. */
export async function currentAccount(): Promise<Account | null> {
  const id = await currentAccountId();
  return id == null ? null : loadAccount(id);
}

// ── роли и владелец ───────────────────────────────────────────────────────────
//
// Владелец — не роль в БД, а адрес из OWNER_EMAIL: совпал email при входе → owner, и отобрать это
// из UI нельзя (иначе владелец мог бы случайно разжаловать сам себя и потерять доступ). Роль в БД
// хранит только admin/player, которые раздаёт владелец. Эффективная роль = owner по почте ИЛИ то,
// что записано. Это одно место правды — им пользуются и вход (какую роль вшить в куку), и панель.

export const ownerEmail = () => (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();

export function isOwnerEmail(email: string): boolean {
  const owner = ownerEmail();
  return owner.length > 0 && email.trim().toLowerCase() === owner;
}

/** Роль, с которой аккаунт реально ходит по сайту: owner по почте перекрывает запись в БД. */
export function effectiveRole(account: { email: string; role: string }): Role {
  if (isOwnerEmail(account.email)) return "owner";
  return account.role === "admin" ? "admin" : "player";
}

/** Текущая роль запроса (owner/admin/player), либо null если не вошёл. */
export async function currentRole(): Promise<Role | null> {
  const acc = await currentAccount();
  return acc ? effectiveRole(acc) : null;
}

/** Свободный slug на основе ника: `nick`, `nick-2`, `nick-3`… — slug уникален у Player. */
async function uniqueSlug(base: string): Promise<string> {
  const root = base || "player";
  let slug = root;
  for (let n = 2; await prisma.player.findUnique({ where: { slug }, select: { id: true } }); n++) {
    slug = `${root}-${n}`;
  }
  return slug;
}

/** Новый игрок сам завёл профиль: создаём Player и сразу привязываем. Возвращает slug профиля. */
export async function createProfileFor(accountId: number, nickname: string): Promise<string> {
  const nick = nickname.trim();
  if (!nick) throw new Error("Укажите ник");
  const slug = await uniqueSlug(slugify(nick));
  const player = await prisma.player.create({ data: { slug, nickname: nick } });
  await prisma.userAccount.update({ where: { id: accountId }, data: { playerId: player.id, claimId: null } });
  return slug;
}

/** Заявка на существующего игрока — ждёт подтверждения оператора. Занятого игрока заявить нельзя. */
export async function claimExisting(accountId: number, playerId: number): Promise<void> {
  const taken = await prisma.userAccount.findUnique({ where: { playerId }, select: { id: true } });
  if (taken) throw new Error("Этот игрок уже привязан к другому аккаунту");
  const exists = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
  if (!exists) throw new Error("Игрок не найден");
  await prisma.userAccount.update({ where: { id: accountId }, data: { claimId: playerId } });
}

/** Игроки, к которым ещё можно привязаться, — не занятые чьей-то подтверждённой привязкой. */
export async function linkablePlayers() {
  const linked = await prisma.userAccount.findMany({
    where: { playerId: { not: null } },
    select: { playerId: true },
  });
  const taken = new Set(linked.map((l) => l.playerId!));
  const players = await prisma.player.findMany({
    orderBy: { nickname: "asc" },
    select: { id: true, nickname: true, slug: true },
  });
  return players.filter((p) => !taken.has(p.id));
}

// ── операторская модерация заявок ────────────────────────────────────────────

/** Заявки, ждущие подтверждения: есть claim, но привязки ещё нет. */
export function pendingClaims() {
  return prisma.userAccount.findMany({
    where: { claimId: { not: null }, playerId: null },
    include: { claim: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Оператор подтвердил заявку: claim → привязка. Если игрока успели занять — отказываем. */
export async function approveClaim(accountId: number): Promise<void> {
  const acc = await prisma.userAccount.findUnique({ where: { id: accountId }, select: { claimId: true } });
  if (!acc?.claimId) return;
  const taken = await prisma.userAccount.findUnique({ where: { playerId: acc.claimId }, select: { id: true } });
  if (taken && taken.id !== accountId) throw new Error("Игрок уже привязан к другому аккаунту");
  await prisma.userAccount.update({ where: { id: accountId }, data: { playerId: acc.claimId, claimId: null } });
}

/** Оператор отклонил заявку: просто снимаем claim, аккаунт остаётся без привязки. */
export async function rejectClaim(accountId: number): Promise<void> {
  await prisma.userAccount.update({ where: { id: accountId }, data: { claimId: null } });
}

// ── панель ролей (только владелец) ────────────────────────────────────────────

/** Все аккаунты для панели владельца — с профилем/заявкой и эффективной ролью. */
export async function listAccounts() {
  const rows = await prisma.userAccount.findMany({
    include: { player: true, claim: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((a) => ({ ...a, effectiveRole: effectiveRole(a) }));
}

/** Владелец меняет роль аккаунта. Владельца по почте не трогаем — его роль задаёт OWNER_EMAIL. */
export async function setAccountRole(targetId: number, role: "admin" | "player"): Promise<void> {
  const target = await prisma.userAccount.findUnique({ where: { id: targetId }, select: { email: true } });
  if (!target) throw new Error("Аккаунт не найден");
  if (isOwnerEmail(target.email)) throw new Error("Роль владельца задаётся через OWNER_EMAIL");
  await prisma.userAccount.update({ where: { id: targetId }, data: { role } });
}

/** Гард для страниц/экшенов владельца: вернуть аккаунт владельца или бросить. */
export async function requireOwner() {
  const acc = await currentAccount();
  if (!acc || effectiveRole(acc) !== "owner") throw new Error("Доступ только для владельца");
  return acc;
}

// ── вход по email + паролю ─────────────────────────────────────────────────────
//
// Второй способ входа рядом с Google. Ключ аккаунта — email (уникален): один человек ↔ один аккаунт,
// хоть Google, хоть пароль, хоть оба. Правила безопасности:
//   • регистрация НЕ трогает уже существующий email — иначе, зная чужую почту, можно было бы
//     подсадить свой пароль в чужой Google-аккаунт (перехват). Забыл/хочет пароль — через сброс.
//   • сброс/подтверждение доказывают владение почтой (ссылка приходит на неё) — только они ставят
//     пароль существующему аккаунту и поднимают emailVerified.
//   • вход по паролю закрыт до подтверждения почты; Google-вход подтверждён самим Google.

/** Выдать сессию аккаунту с правильной ролью: владельца по OWNER_EMAIL закрепляем в БД (как в OAuth). */
export async function establishSession(accountId: number): Promise<void> {
  const account = await prisma.userAccount.findUnique({ where: { id: accountId } });
  if (!account) return;
  if (isOwnerEmail(account.email) && account.role !== "owner") {
    await prisma.userAccount.update({ where: { id: account.id }, data: { role: "owner" } });
  }
  await setSessionCookie(account.id, effectiveRole(account));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Нормализованный (нижний регистр, без пробелов) email — им всегда ищем и пишем. */
const normEmail = (email: string) => email.trim().toLowerCase();

/** Претензии к формату почты, либо null. */
export function emailProblem(email: string): string | null {
  return EMAIL_RE.test(normEmail(email)) ? null : "Введите корректный email";
}

/** Отправить письмо с подтверждением почты аккаунту (выпуск токена + ссылка). */
async function sendVerification(accountId: number, email: string): Promise<void> {
  const token = await issueToken(accountId, "verify");
  await sendVerifyEmail(email, `${await appUrl()}/api/auth/verify?token=${token}`);
}

export type RegisterResult = { ok: true } | { ok: false; error: string };

/** Регистрация по email + паролю. Заводит аккаунт (почта не подтверждена) и шлёт письмо-подтверждение. */
export async function registerWithPassword(email: string, password: string, name: string): Promise<RegisterResult> {
  const mail = normEmail(email);
  const ep = emailProblem(mail);
  if (ep) return { ok: false, error: ep };
  const pp = passwordProblem(password);
  if (pp) return { ok: false, error: pp };

  const existing = await prisma.userAccount.findUnique({ where: { email: mail }, select: { id: true } });
  if (existing) return { ok: false, error: "Почта уже занята. Войдите или восстановите пароль." };

  const account = await prisma.userAccount.create({
    data: { email: mail, passwordHash: hashPassword(password), name: name.trim() || null },
  });
  await sendVerification(account.id, mail);
  return { ok: true };
}

export type LoginResult =
  | { ok: true; accountId: number }
  | { ok: false; error: string; unverified?: boolean };

/** Вход по email + паролю. Возвращает id аккаунта для выдачи сессии, либо ошибку. */
export async function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  const mail = normEmail(email);
  const account = await prisma.userAccount.findUnique({ where: { email: mail } });
  // Одинаковый текст на «нет такого аккаунта» и «пароль не тот» — не подсказываем, что почта есть.
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return { ok: false, error: "Неверная почта или пароль" };
  }
  if (!account.emailVerified) {
    return { ok: false, error: "Почта не подтверждена — проверьте письмо", unverified: true };
  }
  return { ok: true, accountId: account.id };
}

/** Повторно выслать подтверждение почты (если аккаунт есть и ещё не подтверждён). Молча — без утечки. */
export async function resendVerification(email: string): Promise<void> {
  const account = await prisma.userAccount.findUnique({ where: { email: normEmail(email) } });
  if (account && !account.emailVerified) await sendVerification(account.id, account.email);
}

/** Подтверждение почты по токену из письма. Возвращает id аккаунта (для выдачи сессии) или null. */
export async function verifyEmail(token: string): Promise<number | null> {
  const accountId = await consumeToken(token, "verify");
  if (accountId == null) return null;
  await prisma.userAccount.update({ where: { id: accountId }, data: { emailVerified: true } });
  return accountId;
}

/** Запрос сброса пароля: шлём ссылку, если аккаунт есть. Наружу всегда «письмо отправлено» — без утечки. */
export async function startPasswordReset(email: string): Promise<void> {
  const account = await prisma.userAccount.findUnique({ where: { email: normEmail(email) } });
  if (!account) return;
  const token = await issueToken(account.id, "reset");
  await sendResetEmail(account.email, `${await appUrl()}/reset?token=${token}`);
}

export type ResetResult = { ok: true; accountId: number } | { ok: false; error: string };

/** Завершение сброса: гасим токен, ставим новый пароль. Сброс доказывает почту → и подтверждаем её. */
export async function completePasswordReset(token: string, password: string): Promise<ResetResult> {
  const pp = passwordProblem(password);
  if (pp) return { ok: false, error: pp };
  const accountId = await consumeToken(token, "reset");
  if (accountId == null) return { ok: false, error: "Ссылка недействительна или устарела. Запросите сброс заново." };
  await prisma.userAccount.update({
    where: { id: accountId },
    data: { passwordHash: hashPassword(password), emailVerified: true },
  });
  return { ok: true, accountId };
}
