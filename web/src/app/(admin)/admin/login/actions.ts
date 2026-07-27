"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, adminConfigured, issueToken, passwordOk } from "@/lib/auth";

// Вход и выход админки. Пароль приходит только сюда, на сервер, и дальше куки не покидает.

/** Куда можно вернуть после входа: только внутренний путь, иначе это открытый редирект. */
function safeNext(raw: unknown): string {
  const s = String(raw ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

export async function login(_state: string | null, form: FormData): Promise<string | null> {
  if (!adminConfigured()) return "ADMIN_PASSWORD не задан в web/.env — вход невозможен";
  if (!passwordOk(String(form.get("password") ?? ""))) return "Неверный пароль";

  (await cookies()).set(ADMIN_COOKIE, issueToken(), {
    httpOnly: true, // из JS куку не прочитать
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production", // на localhost по http кука бы не поставилась
    path: "/",
  });
  redirect(safeNext(form.get("next")));
}

export async function logout(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
