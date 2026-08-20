// Только сервер: одноразовые токены для подтверждения почты и сброса пароля (модель AuthToken).
//
// Как это безопасно: пользователю в письмо уходит сырой токен (случайные 32 байта), а в БД лежит
// только его sha256-хеш. Найти аккаунт по хешу можно, восстановить сам токен из хеша — нельзя,
// поэтому утечка БД не раздаёт доступы (в отличие от хранения ссылок целиком). Токен гасится при
// использовании и протухает по сроку — повторно не сработает.

import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "./prisma";

export type TokenPurpose = "verify" | "reset";

// Сроки жизни: подтверждение почты не горит (сутки), сброс пароля — узкое окно (час).
const TTL_MS: Record<TokenPurpose, number> = {
  verify: 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
};

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

/**
 * Выпустить токен для аккаунта: чистим прежние того же назначения (одна живая ссылка на цель),
 * пишем хеш нового и возвращаем СЫРОЙ токен — его кладём в ссылку письма, в БД он не остаётся.
 */
export async function issueToken(accountId: number, purpose: TokenPurpose): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  await prisma.authToken.deleteMany({ where: { accountId, purpose } });
  await prisma.authToken.create({
    data: {
      accountId,
      purpose,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TTL_MS[purpose]),
    },
  });
  return raw;
}

/**
 * Погасить токен: находим по хешу, проверяем назначение/срок/что не использован, помечаем usedAt.
 * Возвращает id аккаунта или null (не найден / чужое назначение / протух / уже использован).
 */
export async function consumeToken(raw: string, purpose: TokenPurpose): Promise<number | null> {
  if (!raw) return null;
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < new Date()) return null;
  await prisma.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.accountId;
}
