"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/account";

// Ссылка на внешний источник id матчей турнира. Право то же, что и у самого архива: кто заводит
// встречи, тот и указывает, откуда берёт номера карт.

export async function saveMatchesUrl(form: FormData): Promise<void> {
  await requirePermission("series.edit");

  const slug = String(form.get("slug") ?? "");
  const raw = String(form.get("matchesUrl") ?? "").trim();
  // Пустое поле — это «источника нет», а не пустая строка в БД: так проверка `matchesUrl &&`
  // на странице остаётся честной.
  const value = raw ? (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) : null;

  await prisma.tournament.update({ where: { slug }, data: { matchesUrl: value } });
  revalidatePath(`/admin/series/${slug}`);
}
