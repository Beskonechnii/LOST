"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentAccountId, clearSessionCookie } from "@/lib/player-session";
import { createProfileFor, claimExisting } from "@/lib/account";

// Действия кабинета игрока. Все требуют вошедшего аккаунта — id берём из сессии, а не из формы,
// чтобы нельзя было действовать от чужого имени.

/** Выйти из кабинета. */
export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/me");
}

/** Новый игрок завёл профиль по нику — создаём и уводим на его страницу в ростере. */
export async function createProfile(_state: string | null, form: FormData): Promise<string | null> {
  const id = await currentAccountId();
  if (id == null) return "Сессия истекла — войдите снова";
  const nick = String(form.get("nickname") ?? "").trim();
  if (!nick) return "Укажите ник";
  let slug: string;
  try {
    slug = await createProfileFor(id, nick);
  } catch (e) {
    return e instanceof Error ? e.message : "Не удалось создать профиль";
  }
  redirect(`/roster/players/${slug}`);
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
