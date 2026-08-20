"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentAccountId, clearSessionCookie } from "@/lib/player-session";
import {
  createProfileFor,
  claimExisting,
  registerWithPassword,
  loginWithPassword,
  establishSession,
} from "@/lib/account";

// Действия кабинета игрока. Все требуют вошедшего аккаунта — id берём из сессии, а не из формы,
// чтобы нельзя было действовать от чужого имени.

/** Выйти из кабинета. */
export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/me");
}

// ── вход/регистрация по email + паролю ─────────────────────────────────────────

// Состояние форм входа: только текст ошибки — успех уводит редиректом, показывать нечего.
export type AuthState = { error?: string } | null;

/** Регистрация: заводим аккаунт и сразу пускаем в кабинет. Писем нет — подтверждать нечего, а до
 *  апрува аккаунт всё равно в воронке (draft) и в лиге ничего не значит. */
export async function register(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const name = String(form.get("name") ?? "");
  if (password !== confirm) return { error: "Пароли не совпадают" };
  const res = await registerWithPassword(email, password, name);
  if (!res.ok) return { error: res.error };
  await establishSession(res.accountId);
  redirect("/me");
}

/** Вход по паролю: успех → сессия и redirect в кабинет. */
export async function login(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const res = await loginWithPassword(email, password);
  if (!res.ok) return { error: res.error };
  await establishSession(res.accountId);
  redirect("/me");
}

/** Новый игрок завёл профиль по нику — создаём и уводим на его страницу в ростере. */
export async function createProfile(_state: string | null, form: FormData): Promise<string | null> {
  const id = await currentAccountId();
  if (id == null) return "Сессия истекла — войдите снова";
  const nick = String(form.get("nickname") ?? "").trim();
  if (!nick) return "Укажите ник";
  let playerId: number;
  try {
    playerId = await createProfileFor(id, nick);
  } catch (e) {
    return e instanceof Error ? e.message : "Не удалось создать профиль";
  }
  redirect(`/roster/players/${playerId}`);
}

/** Заявка на существующего игрока — уходит оператору на подтверждение. */
export async function claim(_state: string | null, form: FormData): Promise<string | null> {
  const id = await currentAccountId();
  if (id == null) return "Сессия истекла — войдите снова";
  const playerId = Number(form.get("playerId"));
  if (!Number.isFinite(playerId) || playerId <= 0) return "Выберите себя из списка";
  try {
    await claimExisting(id, playerId);
  } catch (e) {
    return e instanceof Error ? e.message : "Не удалось подать заявку";
  }
  revalidatePath("/me");
  return null;
}
