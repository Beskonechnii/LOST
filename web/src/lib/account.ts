// Только сервер: операции над аккаунтами игроков поверх сессии (lib/player-auth.ts) и БД.
// Одно место правды для «кто вошёл», «завести профиль», «подать/подтвердить заявку» — чтобы
// правила привязки не разъезжались между страницей /me и админкой.

import "server-only";
import { prisma } from "./prisma";
import { currentAccountId } from "./player-session";
import type { Role } from "./player-auth";
import { slugify } from "./profiles";

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
