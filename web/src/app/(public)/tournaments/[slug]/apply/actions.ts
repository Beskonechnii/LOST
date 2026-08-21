"use server";

import { revalidatePath } from "next/cache";
import { currentAccount } from "@/lib/account";
import { submitTeamApplication } from "@/lib/team-application";
import { applyLink, emptyPlayer, parseMmr, parseRole, splitTeamName, type PlayerDraft, type TeamDraft } from "@/lib/roster-import";
import { slugify, normalizeTelegram } from "@/lib/profiles";

// Приём заявки от капитана. Форма шлёт строки состава плоскими полями (nickname-0, role-0 …) —
// собираем их здесь в тот же `TeamDraft`, что приходит из импорта файла. Дальше заявка живёт по
// общим правилам: очередь, замечания, апрув (TOURNAMENTS-PLAN.md, этап 5).

export type ApplyState = { error?: string; ok?: string } | null;

const ROWS = 8; // пятёрка, тренер и пара замен — больше строк в форме обычно не нужно

export async function submitApplication(_prev: ApplyState, form: FormData): Promise<ApplyState> {
  const me = await currentAccount();
  if (!me) return { error: "Заявку подаёт вошедший капитан — войдите в кабинет" };
  if (me.status !== "active") return { error: "Заявку можно подать после того, как ваша анкета одобрена" };

  const raw = String(form.get("name") ?? "");
  const { name, tag } = splitTeamName(raw);
  const players: PlayerDraft[] = [];
  for (let i = 0; i < ROWS; i++) {
    const nickname = String(form.get(`nickname-${i}`) ?? "").trim();
    if (!nickname) continue;
    const p = emptyPlayer(nickname);
    p.realName = String(form.get(`realName-${i}`) ?? "").trim() || null;
    p.role = parseRole(String(form.get(`role-${i}`) ?? ""));
    p.mmr = parseMmr(String(form.get(`mmr-${i}`) ?? ""));
    p.isCaptain = String(form.get("captain") ?? "") === String(i);
    const tg = String(form.get(`telegram-${i}`) ?? "").trim();
    if (tg) p.telegram = normalizeTelegram(tg);
    const link = String(form.get(`link-${i}`) ?? "").trim();
    if (link) applyLink(p, link);
    players.push(p);
  }

  const draft: TeamDraft = {
    slug: slugify(name),
    name,
    tag: String(form.get("tag") ?? "").trim() || tag,
    players,
  };

  try {
    const divisionRaw = String(form.get("divisionId") ?? "");
    await submitTeamApplication(
      me.id,
      Number(form.get("tournamentId")),
      divisionRaw ? Number(divisionRaw) : null,
      draft,
    );
    revalidatePath(`/tournaments/${String(form.get("tournamentSlug") ?? "")}/apply`);
    return { ok: "Заявка отправлена — она появится в очереди организаторов" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось отправить заявку" };
  }
}
