// Только сервер: операции над аккаунтами игроков поверх сессии (lib/player-auth.ts) и БД.
// Одно место правды для «кто вошёл», «завести профиль», «подать/подтвердить заявку» — чтобы
// правила привязки не разъезжались между страницей /me и админкой.

import "server-only";
import { prisma } from "./prisma";
import { currentAccountId, setSessionCookie } from "./player-session";
import type { Role } from "./player-auth";
import { slugify, accountIdFromUrl, normalizeTelegram, parseBirthday } from "./profiles";
import { hashPassword, verifyPassword, passwordProblem } from "./password";
import { hasPermission, permissionsOf, type PermissionKey } from "./permissions";

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

// ── воронка регистрации ───────────────────────────────────────────────────────
//
// Регистрация — это заявка, а не пропуск: вошёл → draft (анкеты нет) → pending (анкета отправлена)
// → active (одобрен) либо rejected (отказ с причиной, анкету можно поправить и отправить снова).
// Сам Player заводится только при апруве — иначе неодобренный сразу попал бы в публичный ростер
// (витрины читают Player без фильтров). Владелец вне воронки: он всегда active, иначе, зачистив
// базу, он запер бы сам себя — апрувить его было бы некому.

export type AccountStatus = "draft" | "pending" | "active" | "rejected";

const STATUSES: AccountStatus[] = ["draft", "pending", "active", "rejected"];

/** Статус, с которым аккаунт реально живёт: у владельца по OWNER_EMAIL всегда active. */
export function accountStatus(account: { email: string; status: string }): AccountStatus {
  if (isOwnerEmail(account.email)) return "active";
  return STATUSES.includes(account.status as AccountStatus) ? (account.status as AccountStatus) : "draft";
}

/** Одобрен ли аккаунт (прошёл модерацию). */
export const isActiveAccount = (account: { email: string; status: string }) => accountStatus(account) === "active";

// ── гранулярные права ─────────────────────────────────────────────────────────
//
// Реестр прав — чистый permissions.ts, а гарды здесь: они читают БД. Роль вшита в подписанную куку и
// обновляется лишь при следующем входе, для прав это неприемлемо — снял право, оно обязано пропасть
// сразу. Служебная часть не горячий путь, лишний запрос там дешевле дырки в доступе.

/** Права вошедшего: пусто, если не вошёл. */
export async function currentPermissions(): Promise<PermissionKey[]> {
  const acc = await currentAccount();
  return acc ? permissionsOf(effectiveRole(acc), acc.permissions) : [];
}

/** Есть ли у вошедшего право — для «показывать ли плитку/подвкладку». Не бросает. */
export async function can(key: PermissionKey): Promise<boolean> {
  const acc = await currentAccount();
  return !!acc && hasPermission(effectiveRole(acc), acc.permissions, key);
}

/** Гард страницы/экшена/роута: вернуть аккаунт с правом или бросить. Гейт в роуте обязателен —
 *  страницу можно и не открывать, дойдя до API напрямую. */
export async function requirePermission(key: PermissionKey): Promise<Account> {
  const acc = await currentAccount();
  if (!acc || !hasPermission(effectiveRole(acc), acc.permissions, key)) {
    throw new Error("Недостаточно прав");
  }
  return acc;
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

/** Новый игрок сам завёл профиль: создаём Player и сразу привязываем. Возвращает id профиля
 *  (карточки ростера адресуются числовым id, а не slug — см. /roster/players/[id]). */
export async function createProfileFor(accountId: number, nickname: string): Promise<number> {
  const nick = nickname.trim();
  if (!nick) throw new Error("Укажите ник");
  const slug = await uniqueSlug(slugify(nick));
  const player = await prisma.player.create({ data: { slug, nickname: nick } });
  await prisma.userAccount.update({ where: { id: accountId }, data: { playerId: player.id, claimId: null } });
  return player.id;
}

// ── правка своей анкеты игроком (self-service) ─────────────────────────────────
//
// Игрок правит только СВОИ анкетные поля. То, что принадлежит лиге (MMR, роль в составе, TP,
// номер, фото/баннер), редактирует лишь оператор в /admin — здесь этих полей нет намеренно.
// slug не трогаем никогда (см. schema): от него зависят файлы картинок, поэтому меняется ник,
// а адрес ассета — нет.

// Сколько ждать между сменами ника самим игроком. Формального понятия «сезон» в модели пока нет
// (см. §9 в CLAUDE.md), поэтому приближаем скользящим окном «примерно раз в сезон».
const NICKNAME_COOLDOWN_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

export type OwnProfileInput = {
  nickname?: string;
  realName?: string;
  city?: string;
  country?: string;
  birthday?: string;
  telegram?: string;
  profileLink?: string; // ссылка на Dotabuff/Steam/Stratz → account_id (одно поле для игрока)
  achievements?: string;
};

/** Записать правки анкеты от имени вошедшего игрока. Возвращает ошибку строкой или null при успехе. */
export async function updateOwnProfile(accountId: number, input: OwnProfileInput): Promise<string | null> {
  const account = await prisma.userAccount.findUnique({ where: { id: accountId }, select: { playerId: true } });
  if (!account?.playerId) return "Профиль не привязан";
  const player = await prisma.player.findUnique({
    where: { id: account.playerId },
    select: { nickname: true, nicknameChangedAt: true },
  });
  if (!player) return "Профиль не найден";

  const data: Record<string, unknown> = {};

  // Ник — единственное поле с лимитом: slug не меняем, но саму смену ограничиваем «раз в сезон».
  if (input.nickname !== undefined) {
    const nick = input.nickname.trim();
    if (!nick) return "Ник не может быть пустым";
    if (nick !== player.nickname) {
      const last = player.nicknameChangedAt?.getTime();
      if (last != null) {
        const daysLeft = Math.ceil((last + NICKNAME_COOLDOWN_DAYS * DAY_MS - Date.now()) / DAY_MS);
        if (daysLeft > 0) {
          return `Ник в этом сезоне уже менялся. Сменить снова можно через ${daysLeft} дн. или попросить оператора.`;
        }
      }
      data.nickname = nick;
      data.nicknameChangedAt = new Date();
    }
  }

  // Простые текстовые поля: пусто → null (дыр в анкете быть не должно).
  const setText = (key: keyof OwnProfileInput, column: string) => {
    if (input[key] !== undefined) data[column] = (input[key] as string).trim() || null;
  };
  setText("realName", "realName");
  setText("city", "city");
  setText("country", "country");
  setText("achievements", "achievements");

  if (input.telegram !== undefined) {
    const raw = input.telegram.trim();
    if (raw === "") data.telegram = null;
    else {
      const handle = normalizeTelegram(raw);
      if (!handle) return `«${raw}» не похоже на телеграм-хендл`;
      data.telegram = handle;
    }
  }

  if (input.birthday !== undefined) {
    const raw = input.birthday.trim();
    if (raw === "") data.birthday = null;
    else {
      const date = parseBirthday(raw);
      if (!date) return `Дата «${raw}» не разобрана — ждём 21.04.1998`;
      data.birthday = date;
    }
  }

  // Ссылка на профиль → account_id: одно поле для игрока, три ссылки (Dotabuff/Stratz/Steam)
  // выводятся из него автоматически (profiles.ts). Пусто → отвязываем account_id.
  if (input.profileLink !== undefined) {
    const raw = input.profileLink.trim();
    if (raw === "") data.accountId = null;
    else {
      const id = accountIdFromUrl(raw);
      if (!id) return `Не разобрал «${raw}». Нужна ссылка на Dotabuff, Stratz или steamcommunity.com/profiles/…`;
      data.accountId = id;
    }
  }

  if (Object.keys(data).length > 0) {
    await prisma.player.update({ where: { id: account.playerId }, data });
  }
  return null;
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
//     подсадить свой пароль в чужой Google-аккаунт (перехват).
//   • писем нет вообще (почтовый флоу убран), поэтому подтверждение почты не гейт входа: вход по
//     паролю открыт сразу, а `emailVerified` поднимает только Google. Пускать внутрь не страшно —
//     новый аккаунт всё равно попадает в воронку (draft) и до апрува ничего в лиге не значит.
//   • «забыли пароль» из-за этого не работает: пути обхода — вход через Google той же почтой либо
//     удаление аккаунта и повторная регистрация (см. ACCOUNTS-PLAN.md §2.4).

/** Выдать сессию аккаунту с правильной ролью: владельца по OWNER_EMAIL закрепляем в БД (как в OAuth):
 *  роль owner и статус active — он вне воронки, апрувить его некому. */
export async function establishSession(accountId: number): Promise<void> {
  const account = await prisma.userAccount.findUnique({ where: { id: accountId } });
  if (!account) return;
  if (isOwnerEmail(account.email) && (account.role !== "owner" || account.status !== "active")) {
    await prisma.userAccount.update({ where: { id: account.id }, data: { role: "owner", status: "active" } });
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

export type RegisterResult = { ok: true; accountId: number } | { ok: false; error: string };

/** Регистрация по email + паролю. Заводит аккаунт в статусе draft (дефолт схемы) и отдаёт его id —
 *  сессию выдаёт вызывающий, а дальше кабинет требует анкету. Писем не шлём: почтового флоу нет. */
export async function registerWithPassword(email: string, password: string, name: string): Promise<RegisterResult> {
  const mail = normEmail(email);
  const ep = emailProblem(mail);
  if (ep) return { ok: false, error: ep };
  const pp = passwordProblem(password);
  if (pp) return { ok: false, error: pp };

  const existing = await prisma.userAccount.findUnique({ where: { email: mail }, select: { id: true } });
  if (existing) return { ok: false, error: "Почта уже занята — войдите под ней." };

  const account = await prisma.userAccount.create({
    data: { email: mail, passwordHash: hashPassword(password), name: name.trim() || null },
  });
  return { ok: true, accountId: account.id };
}

export type LoginResult = { ok: true; accountId: number } | { ok: false; error: string };

/** Вход по email + паролю. Возвращает id аккаунта для выдачи сессии, либо ошибку. */
export async function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  const mail = normEmail(email);
  const account = await prisma.userAccount.findUnique({ where: { email: mail } });
  // Одинаковый текст на «нет такого аккаунта» и «пароль не тот» — не подсказываем, что почта есть.
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return { ok: false, error: "Неверная почта или пароль" };
  }
  return { ok: true, accountId: account.id };
}

// ── управление своим входом из кабинета (уже вошедший игрок) ────────────────────

/** Сменить (или задать впервые) пароль из кабинета. Текущий пароль спрашиваем, только если он есть —
 *  у входившего лишь через Google его нет, а владение аккаунтом уже доказано активной сессией. */
export async function changePassword(
  accountId: number,
  current: string,
  next: string,
): Promise<string | null> {
  const account = await prisma.userAccount.findUnique({
    where: { id: accountId },
    select: { passwordHash: true },
  });
  if (!account) return "Сессия истекла — войдите снова";
  // Пароль уже задан → без верного текущего менять нельзя (защита от смены по угнанной сессии).
  if (account.passwordHash && !verifyPassword(current, account.passwordHash)) {
    return "Текущий пароль неверен";
  }
  const pp = passwordProblem(next);
  if (pp) return pp;
  await prisma.userAccount.update({ where: { id: accountId }, data: { passwordHash: hashPassword(next) } });
  return null;
}

/** Удалить свой аккаунт. Профиль игрока (Player) и его турнирная история остаются — рвётся только вход
 *  (Player.account через onDelete: SetNull). Q4 концепта. */
export async function deleteOwnAccount(accountId: number): Promise<void> {
  await prisma.userAccount.delete({ where: { id: accountId } });
}
