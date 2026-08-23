"use server";

import { revalidatePath } from "next/cache";
import { currentAccount } from "@/lib/account";
import { applicationProblems, submitTeamApplication, type Problem } from "@/lib/team-application";
import { applyLink, emptyPlayer, parseMmr, parseRole, splitTeamName, type PlayerDraft, type TeamDraft } from "@/lib/roster-import";
import { slugify, normalizeTelegram } from "@/lib/profiles";

// Приём заявки от капитана. Форма шлёт строки состава плоскими полями (nickname-0, role-0 …) —
// собираем их здесь в тот же `TeamDraft`, что приходит из импорта файла. Дальше заявка живёт по
// общим правилам: очередь, замечания, апрув (TOURNAMENTS-PLAN.md, этап 5).

export type ApplyState = {
  error?: string;
  ok?: string;
  problems?: Problem[];
  /** Введённое капитаном — возвращаем обратно в форму, иначе проверка стирала бы весь ввод. */
  values?: FormValues;
  /** Метка ответа: по ней форма перемонтируется и подхватывает `values` (см. apply-form.tsx). */
  stamp?: number;
} | null;

export type FormValues = {
  name: string;
  tag: string | null;
  divisionId: number | null;
  players: {
    nickname: string;
    realName: string | null;
    role: string | null;
    mmr: number | null;
    link: string | null;
    telegram: string | null;
    isCaptain: boolean;
  }[];
};

const ROWS = 8; // пятёрка, тренер и пара замен — больше строк в форме обычно не нужно

export async function submitApplication(_prev: ApplyState, form: FormData): Promise<ApplyState> {
  const me = await currentAccount();
  // Подать может любой вошедший аккаунт, даже в статусе `draft` (решение Стаса, 23.08.2026):
  // капитан новой команды часто сам ещё не в лиге, а заявка всё равно проходит модерацию —
  // второй фильтр на входе только мешал бы.
  if (!me) return { error: "Заявку подаёт вошедший капитан — войдите в кабинет" };

  const raw = String(form.get("name") ?? "");
  const { name, tag } = splitTeamName(raw);
  const players: PlayerDraft[] = [];
  // Ссылку показываем обратно ровно ту, что ввёл капитан: у OpenDota своего поля в модели нет
  // (из неё берётся только account_id), и без этого она пропадала бы из формы после проверки.
  const rawLinks: string[] = [];
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
    rawLinks.push(link);
    players.push(p);
  }

  const draft: TeamDraft = {
    slug: slugify(name),
    name,
    tag: String(form.get("tag") ?? "").trim() || tag,
    players,
  };

  const divisionRaw = String(form.get("divisionId") ?? "");
  const divisionId = divisionRaw ? Number(divisionRaw) : null;

  // То же самое, но в виде, который понимает форма: любой ответ возвращает ввод на место.
  const values: FormValues = {
    name,
    tag: draft.tag,
    divisionId,
    players: players.map((p, i) => ({
      nickname: p.nickname,
      realName: p.realName ?? null,
      role: p.role ?? null,
      mmr: p.mmr ?? null,
      link: rawLinks[i] || p.dotabuffUrl || p.stratzUrl || p.steamUrl || null,
      telegram: p.telegram ?? null,
      isCaptain: p.isCaptain ?? false,
    })),
  };
  const stamp = Date.now();

  // «Проверить состав» — тот же разбор формы, но без записи: капитан видит замечания до отправки,
  // а не узнаёт о них от модератора через день (TOURNAMENTS-PLAN.md, Э9).
  const problems = await applicationProblems(draft, divisionId);
  if (String(form.get("intent") ?? "") === "check") {
    const blocking = problems.filter((p) => p.level === "block");
    return {
      problems,
      values,
      stamp,
      ok: blocking.length === 0 ? "Замечаний, мешающих отправке, нет" : undefined,
      error: blocking.length ? "Это надо поправить до отправки" : undefined,
    };
  }
  // Красное замечание — это ошибка составителя (дубль ника, один account_id на двоих): отправлять
  // такую заявку модератору незачем, она вернётся с той же причиной.
  const blocking = problems.filter((p) => p.level === "block");
  if (blocking.length)
    return { problems, values, stamp, error: "Заявку нельзя отправить, пока есть красные замечания" };

  try {
    await submitTeamApplication(me.id, Number(form.get("tournamentId")), divisionId, draft);
    revalidatePath(`/tournaments/${String(form.get("tournamentSlug") ?? "")}/apply`);
    return { problems, values, stamp, ok: "Заявка отправлена — она появится в очереди организаторов" };
  } catch (e) {
    return { values, stamp, error: e instanceof Error ? e.message : "Не удалось отправить заявку" };
  }
}
