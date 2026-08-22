"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, currentAccount } from "@/lib/account";
import { enrichTeam, type EnrichNote } from "@/lib/enrich";
import {
  normalizeDrafts,
  parseDelimited,
  parseGrid,
  parsePlayerLines,
  type PlayerDraft,
  type TeamDraft,
} from "@/lib/roster-import";
import { slugify } from "@/lib/profiles";
import {
  applicationProblems,
  approveApplication,
  createApplications,
  type Problem,
} from "@/lib/team-application";
import { prisma } from "@/lib/prisma";

// Ручная регистрация команды оператором. Отдельно от импорта файла (там пачка) и от заявки
// капитана (там человек снаружи) — но записывается тем же путём: заявка → апрув. Один путь в
// ростер, а значит одни и те же проверки; «оператор же, ему можно» — самый простой способ завести
// в лигу дубль игрока или состав, конфликтующий с чужим.

export type ParsedState = { players?: PlayerDraft[]; error?: string } | null;

/** Вставленный состав текстом → строки формы. Тот же парсер, что у импорта файла. */
export async function parseRoster(_prev: ParsedState, form: FormData): Promise<ParsedState> {
  await requirePermission("tournaments.edit");
  const text = String(form.get("pasted") ?? "").trim();
  if (!text) return { error: "Вставьте состав текстом" };
  // Сначала пробуем табличные раскладки (вдруг вставили кусок таблицы с шапкой), затем построчный
  // разбор — состав, присланный сообщением, шапки не имеет.
  const teams = normalizeDrafts(parseGrid(parseDelimited(text)));
  const players = teams.length ? teams.flatMap((t) => t.players) : parsePlayerLines(text);
  if (players.length === 0)
    return {
      error:
        "Игроков не нашлось. Строка = игрок: «Ник; роль; MMR; ссылка». С шапкой «Команда/Ник/Роль» " +
        "разберётся и без подсказок.",
    };
  return { players };
}

export type EnrichRowsState = { players?: PlayerDraft[]; notes?: EnrichNote[]; error?: string } | null;

/** Подтянуть по строкам account_id, ранг и ник — тот же шаг, что на превью импорта. */
export async function enrichRows(_prev: EnrichRowsState, form: FormData): Promise<EnrichRowsState> {
  await requirePermission("tournaments.edit");
  try {
    const players = JSON.parse(String(form.get("players") ?? "[]")) as PlayerDraft[];
    if (players.length === 0) return { error: "Нечего обогащать" };
    const { team, notes } = await enrichTeam({ slug: "draft", name: "draft", tag: null, players });
    return { players: team.players, notes };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось подтянуть данные" };
  }
}

export type CreateState = { problems?: Problem[]; error?: string; teamId?: number; applicationId?: number } | null;

/**
 * Завести команду. Блокирующие замечания не обходим: заявка остаётся в очереди, оператор чинит
 * данные и апрувит там же — иначе «быстрая форма» стала бы дырой в проверках составов.
 */
export async function createTeam(_prev: CreateState, form: FormData): Promise<CreateState> {
  await requirePermission("tournaments.edit");
  await requirePermission("roster.edit");
  try {
    const tournamentId = Number(form.get("tournamentId"));
    const divisionId = Number(form.get("divisionId")) || null;
    if (!divisionId) return { error: "Выберите дивизион — команде нужно куда встать" };

    const name = String(form.get("name") ?? "").trim();
    if (!name) return { error: "Укажите название команды" };
    const players = (JSON.parse(String(form.get("players") ?? "[]")) as PlayerDraft[]).filter((p) =>
      p.nickname?.trim(),
    );
    if (players.length === 0) return { error: "В составе нет ни одного игрока" };
    // Разобранный текстом состав капитана не помечает — считаем им первого, иначе команда уедет
    // в ростер вообще без капитана.
    if (!players.some((p) => p.isCaptain)) players[0].isCaptain = true;

    const draft: TeamDraft = {
      slug: String(form.get("slug") ?? "").trim() || slugify(name),
      name,
      tag: String(form.get("tag") ?? "").trim() || null,
      players,
    };

    const problems = await applicationProblems(draft, divisionId);
    await createApplications(tournamentId, divisionId, [draft], "admin");
    const application = await prisma.teamApplication.findFirst({
      where: { tournamentId, status: "pending" },
      orderBy: { id: "desc" },
    });
    if (!application) return { error: "Заявка не создалась — попробуйте ещё раз" };

    const tournamentSlug = String(form.get("tournamentSlug") ?? "");
    if (problems.some((p) => p.level === "block")) {
      revalidatePath(`/admin/tournaments/${tournamentSlug}/registrations`);
      return { problems, applicationId: application.id };
    }

    const me = await currentAccount();
    const approved = await approveApplication(application.id, me?.id ?? null);
    revalidatePath(`/admin/tournaments/${tournamentSlug}`);
    revalidatePath("/roster/teams");
    return { problems, teamId: approved.teamId ?? undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось завести команду" };
  }
}
