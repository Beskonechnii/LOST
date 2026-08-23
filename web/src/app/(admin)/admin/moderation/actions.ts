"use server";

import { revalidatePath } from "next/cache";
import { approveClaim, approveRegistration, rejectClaim, rejectRegistration } from "@/lib/account";

// Решения по обеим очередям модерации — анкеты и привязки к профилю. Право accounts.approve
// проверяет сам lib/account.ts — гейт стоит там, чтобы его нельзя было обойти, дойдя до апрува
// мимо этой страницы.

// Состояние форм карточки: только текст ошибки — при успехе строка уходит из очереди.
export type ReviewState = { error?: string } | null;

const accountIdOf = (form: FormData): number => Number(form.get("accountId"));

/** Одобрить заявку. MMR — поле оператора: в анкете он заявленный, в лиге считается настоящим. */
export async function approve(_state: ReviewState, form: FormData): Promise<ReviewState> {
  const raw = String(form.get("mmr") ?? "").trim();
  let mmr: number | null = null;
  if (raw) {
    const n = Number(raw.replace(/\s+/g, ""));
    if (!Number.isInteger(n) || n < 0) return { error: "MMR — целое число или пусто" };
    mmr = n;
  }

  const res = await approveRegistration(accountIdOf(form), mmr);
  if (!res.ok) return { error: res.error };
  revalidatePath("/admin/moderation");
  return null;
}

/** Вернуть заявку с причиной — человек увидит её в кабинете и поправит анкету. */
export async function reject(_state: ReviewState, form: FormData): Promise<ReviewState> {
  const error = await rejectRegistration(accountIdOf(form), String(form.get("reason") ?? ""));
  if (error) return { error };
  revalidatePath("/admin/moderation");
  return null;
}

// ── привязка к профилю ───────────────────────────────────────────────────────
// Отдельная пара экшенов: у привязки нет ни анкеты, ни MMR — решение бинарное, состояние формам
// не нужно, поэтому это простые form actions, а не useActionState как у анкет.

export async function approveLink(form: FormData): Promise<void> {
  await approveClaim(Number(form.get("accountId")));
  revalidatePath("/admin/moderation");
}

export async function rejectLink(form: FormData): Promise<void> {
  await rejectClaim(Number(form.get("accountId")));
  revalidatePath("/admin/moderation");
}
