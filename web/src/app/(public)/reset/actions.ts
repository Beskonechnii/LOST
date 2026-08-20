"use server";

import { redirect } from "next/navigation";
import { startPasswordReset, completePasswordReset, establishSession } from "@/lib/account";

// Действия страницы сброса пароля. Два шага: запросить ссылку (по email) и задать новый пароль (по
// токену из письма). id аккаунта берём из токена, а не из формы — задать пароль может только тот,
// кто получил письмо.

export type ResetState = { error?: string; done?: string } | null;

/** Шаг 1: запрос ссылки сброса. Ответ одинаков, есть почта или нет — не выдаём существование аккаунта. */
export async function requestReset(_state: ResetState, form: FormData): Promise<ResetState> {
  await startPasswordReset(String(form.get("email") ?? ""));
  return { done: "Если такая почта зарегистрирована — мы отправили на неё ссылку для сброса пароля." };
}

/** Шаг 2: задать новый пароль по токену. Успех → сразу в кабинет вошедшим. */
export async function setNewPassword(_state: ResetState, form: FormData): Promise<ResetState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password !== confirm) return { error: "Пароли не совпадают" };
  const res = await completePasswordReset(token, password);
  if (!res.ok) return { error: res.error };
  await establishSession(res.accountId);
  redirect("/me?ok=reset");
}
