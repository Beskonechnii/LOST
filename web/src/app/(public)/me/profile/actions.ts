"use server";

import { revalidatePath } from "next/cache";
import { currentAccountId } from "@/lib/player-session";
import { updateOwnProfile, type OwnProfileInput } from "@/lib/account";

// Правка своей анкеты. id аккаунта берём из сессии, а не из формы — действовать от чужого имени нельзя.
// Список полей — ровно тот, что игроку разрешён (updateOwnProfile его же и стережёт).

export type SaveState = { error?: string; ok?: boolean } | null;

export async function saveProfile(_state: SaveState, form: FormData): Promise<SaveState> {
  const accountId = await currentAccountId();
  if (accountId == null) return { error: "Сессия истекла — войдите снова" };

  const input: OwnProfileInput = {
    nickname: String(form.get("nickname") ?? ""),
    realName: String(form.get("realName") ?? ""),
    city: String(form.get("city") ?? ""),
    country: String(form.get("country") ?? ""),
    birthday: String(form.get("birthday") ?? ""),
    telegram: String(form.get("telegram") ?? ""),
    dotabuffUrl: String(form.get("dotabuffUrl") ?? ""),
    stratzUrl: String(form.get("stratzUrl") ?? ""),
    steamUrl: String(form.get("steamUrl") ?? ""),
    achievements: String(form.get("achievements") ?? ""),
  };

  const error = await updateOwnProfile(accountId, input);
  if (error) return { error };

  revalidatePath("/me/profile");
  revalidatePath("/me");
  return { ok: true };
}
