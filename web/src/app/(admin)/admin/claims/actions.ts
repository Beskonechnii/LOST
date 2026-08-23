"use server";

import { revalidatePath } from "next/cache";
import { approveClaim, rejectClaim } from "@/lib/account";

// Модерация заявок на привязку. Живёт в группе (admin) — доступ закрыт паролем на уровне proxy,
// отдельной проверки здесь не нужно (как и в остальных админских экшенах).

export async function approve(form: FormData): Promise<void> {
  await approveClaim(Number(form.get("accountId")));
  revalidatePath("/admin/claims");
}

export async function reject(form: FormData): Promise<void> {
  await rejectClaim(Number(form.get("accountId")));
  revalidatePath("/admin/claims");
}
