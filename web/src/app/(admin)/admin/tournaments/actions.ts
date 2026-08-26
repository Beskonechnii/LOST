"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/account";
import {
  createDivision,
  drawGroups,
  setEntryDraw,
  createTournament,
  deleteDivision,
  setTeamDivision,
  setTournamentStatus,
  updateDivision,
  updateTournament,
} from "@/lib/tournaments";

// Экшены админки турниров. Право `tournaments.edit` проверяется здесь, а не только гейтом страницы:
// до экшена можно дойти и мимо неё, а сама страница могла быть отрисована со старыми правами
// (docs/archive/ACCOUNTS-PLAN.md §2.2). В `tournaments.ts` гард не переносим — этот модуль зовут и разовые
// скрипты через tsx, где ни куки, ни сессии нет.

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const num = (form: FormData, key: string) => {
  const v = text(form, key);
  return v === "" ? null : Number(v);
};

/** Поля формы турнира — одинаковы у создания и правки, поэтому собираются одним местом. */
const tournamentInput = (form: FormData) => ({
  name: text(form, "name"),
  slug: text(form, "slug"),
  short: text(form, "short"),
  description: text(form, "description"),
  format: text(form, "format"),
  prize: text(form, "prize"),
  status: text(form, "status"),
  startAt: text(form, "startAt"),
  endAt: text(form, "endAt"),
  regOpenAt: text(form, "regOpenAt"),
  regCloseAt: text(form, "regCloseAt"),
});

export async function addTournament(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  const tournament = await createTournament(tournamentInput(form));
  revalidatePath("/admin/tournaments");
  redirect(`/admin/tournaments/${tournament.slug}`);
}

export async function saveTournament(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  const tournament = await updateTournament(Number(form.get("id")), tournamentInput(form));
  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${tournament.slug}`);
}

export async function changeStatus(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  await setTournamentStatus(Number(form.get("id")), text(form, "status"));
  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${text(form, "slug")}`);
}

const divisionInput = (form: FormData) => ({
  name: text(form, "name"),
  slug: text(form, "slug"),
  label: text(form, "label"),
  short: text(form, "short"),
  orderNo: num(form, "orderNo"),
  mmrFrom: num(form, "mmrFrom"),
  mmrTo: num(form, "mmrTo"),
});

export async function addDivision(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  await createDivision(Number(form.get("tournamentId")), divisionInput(form));
  revalidatePath(`/admin/tournaments/${text(form, "tournamentSlug")}`);
}

export async function saveDivision(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  await updateDivision(Number(form.get("id")), divisionInput(form));
  revalidatePath(`/admin/tournaments/${text(form, "tournamentSlug")}`);
  revalidatePath("/roster/teams");
}

export async function removeDivision(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  await deleteDivision(Number(form.get("id")));
  revalidatePath(`/admin/tournaments/${text(form, "tournamentSlug")}`);
}

/** Правка жеребьёвки одной команды: группа и посев. */
export async function saveDraw(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  await setEntryDraw(Number(form.get("entryId")), { group: text(form, "group"), seed: num(form, "seed") });
  revalidatePath(`/admin/tournaments/${text(form, "tournamentSlug")}`);
}

/** Развести дивизион по группам змейкой — по силе состава (src/lib/tournaments.ts). */
export async function autoDraw(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  await drawGroups(Number(form.get("divisionId")), Number(form.get("groups")) || 2);
  revalidatePath(`/admin/tournaments/${text(form, "tournamentSlug")}`);
}

/** Поставить команду в дивизион или снять её оттуда (`divisionId` пустой = снять). */
export async function assignTeam(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  const divisionId = num(form, "divisionId");
  await setTeamDivision(Number(form.get("teamId")), divisionId, { seed: num(form, "seed"), group: text(form, "group") || null });
  revalidatePath(`/admin/tournaments/${text(form, "tournamentSlug")}`);
  revalidatePath("/roster/teams");
}
