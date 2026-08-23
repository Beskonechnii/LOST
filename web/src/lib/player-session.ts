// Только сервер: куки-слой пользовательской сессии поверх крипты из player-auth.ts. Здесь живёт
// `next/headers`, поэтому этот модуль в proxy.ts не тянут (там только чистый player-auth.ts).

import { cookies } from "next/headers";
import { SESSION_COOKIE, issueSession, readSession, type Role, type Session } from "./player-auth";

const cookieOpts = {
  httpOnly: true, // из JS куку не прочитать
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production", // на localhost по http кука бы не поставилась
  path: "/",
};

export async function setSessionCookie(accountId: number, role: Role): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, issueSession(accountId, role), cookieOpts);
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Сессия текущего запроса (id + роль из куки), либо null. */
export async function currentSession(): Promise<Session | null> {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** id вошедшего аккаунта, либо null. */
export async function currentAccountId(): Promise<number | null> {
  return (await currentSession())?.id ?? null;
}
