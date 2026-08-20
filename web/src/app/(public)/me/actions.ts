"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentAccountId, clearSessionCookie } from "@/lib/player-session";
import {
  createProfileFor,
  claimExisting,
  registerWithPassword,
  loginWithPassword,
  startPasswordReset,
  resendVerification,
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

// Состояние форм входа: текст ошибки, флаг «покажи ссылку подтвердить/выслать снова», флаг «готово».
export type AuthState = { error?: string; unverified?: boolean; done?: string } | null;

/** Регистрация: заводим аккаунт и шлём письмо-подтверждение. В сессию НЕ пускаем до подтверждения. */
export async function register(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const name = String(form.get("name") ?? "");
  if (password !== confirm) return { error: "Пароли не совпадают" };
  const res = await registerWithPassword(email, password, name);
  if (!res.ok) return { error: res.error };
  return { done: "Готово! Мы отправили письмо со ссылкой подтверждения на вашу почту." };
}

/** Вход по паролю: успех → сессия и redirect в кабинет; неподтверждённая почта → предложить выслать снова. */
export async function login(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const res = await loginWithPassword(email, password);
  if (!res.ok) return { error: res.error, unverified: res.unverified };
  await establishSession(res.accountId);
  redirect("/me");
}

/** Повторно выслать подтверждение почты. Всегда «отправлено» — не выдаём, есть ли такой аккаунт. */
export async function resend(_state: AuthState, form: FormData): Promise<AuthState> {
  await resendVerification(String(form.get("email") ?? ""));
  return { done: "Если аккаунт есть и не подтверждён — письмо отправлено повторно." };
}

/** Запрос сброса пароля с формы кабинета. Ответ одинаковый независимо от того, есть ли почта. */
export async function forgot(_state: AuthState, form: FormData): Promise<AuthState> {
  await startPasswordReset(String(form.get("email") ?? ""));
  return { done: "Если такая почта зарегистрирована — мы отправили на неё ссылку для сброса пароля." };
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
