"use server";

import { revalidatePath } from "next/cache";
import { requireOwner, setAccountRole } from "@/lib/account";

// Смена ролей — только владелец. Гейт proxy пускает в /admin любого admin/owner, поэтому право
// «раздавать роли» перепроверяем здесь по свежей БД (requireOwner), а не по факту входа в админку.

export async function makeAdmin(form: FormData): Promise<void> {
  await requireOwner();
  await setAccountRole(Number(form.get("accountId")), "admin");
  revalidatePath("/admin/roles");
}

export async function makePlayer(form: FormData): Promise<void> {
  await requireOwner();
  await setAccountRole(Number(form.get("accountId")), "player");
  revalidatePath("/admin/roles");
}
