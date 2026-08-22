"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/account";

import { normalizeDrafts, parseDelimited, parseGrid, unparsedRows, type TeamDraft } from "@/lib/roster-import";
import { readWorkbook, type Grid } from "@/lib/xlsx";
import { enrichTeams, type EnrichNote } from "@/lib/enrich";
import { applicationProblems, writeTeamToRoster, type Problem } from "@/lib/team-application";

// Импорт составов мастером в три шага: источник → разбор и правка → запись. Разбор отделён от
// записи намеренно (TOURNAMENTS-PLAN.md §2.4): файл из чужих рук — всегда сюрприз, и оператор
// должен увидеть, что получилось, до того как это попадёт в ростер.
//
// Пишем сразу в ростер, без промежуточной очереди заявок: заявки — это то, что присылают снаружи,
// а импорт делает сам оператор, и подтверждать самому себе нечего. Проверки при этом те же
// (`applicationProblems`): блокирующее замечание команду не пропускает.

export type ParseState = { teams?: TeamDraft[]; error?: string; note?: string; skipped?: string[] } | null;

/** Гугл-таблица открывается как xlsx по своему export-адресу — id достаём из любой формы ссылки. */
async function fetchSheet(src: string): Promise<Uint8Array> {
  const id = src.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] ?? src.trim();
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`);
  if (!res.ok) throw new Error(`Не удалось скачать таблицу (${res.status}). Открыт ли доступ по ссылке?`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function parseUpload(_prev: ParseState, form: FormData): Promise<ParseState> {
  await requirePermission("tournaments.edit");
  try {
    const file = form.get("file");
    const link = String(form.get("link") ?? "").trim();
    const pasted = String(form.get("pasted") ?? "").trim();
    const sheetFilter = String(form.get("sheet") ?? "").trim().toLowerCase();

    let teams: TeamDraft[] = [];
    let note = "";
    const grids: Grid[] = []; // сетки листов — по ним потом считаем, какие строки не разобрались

    if (file instanceof File && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (/\.xlsx$/i.test(file.name)) {
        const sheets = readWorkbook(bytes).filter((s) => !sheetFilter || s.name.toLowerCase().includes(sheetFilter));
        grids.push(...sheets.map((s) => s.grid));
        teams = sheets.flatMap((s) => parseGrid(s.grid));
        note = `Листы: ${sheets.map((s) => s.name).join(", ") || "не нашлось"}`;
      } else {
        const grid = parseDelimited(new TextDecoder().decode(bytes));
        grids.push(grid);
        teams = parseGrid(grid);
        note = `Файл ${file.name}`;
      }
    } else if (link) {
      const sheets = readWorkbook(await fetchSheet(link)).filter(
        (s) => !sheetFilter || s.name.toLowerCase().includes(sheetFilter),
      );
      grids.push(...sheets.map((s) => s.grid));
      teams = sheets.flatMap((s) => parseGrid(s.grid));
      note = `Листы: ${sheets.map((s) => s.name).join(", ") || "не нашлось"}`;
    } else if (pasted) {
      const grid = parseDelimited(pasted);
      grids.push(grid);
      teams = parseGrid(grid);
      note = "Вставленный текст";
    } else {
      return { error: "Дайте файл, ссылку на таблицу или вставьте текст" };
    }

    const normalized = normalizeDrafts(teams);
    if (normalized.length === 0)
      return {
        error:
          "Составов не нашлось. Нужна либо шапка с колонками «Команда» и «Ник», либо блочная " +
          "раскладка сезонной таблицы LOST.",
      };
    // Что не легло ни в одну команду — показываем списком: «22 игрока» без этого выглядят успехом,
    // даже если в таблице их было тридцать.
    const skipped = grids.flatMap((g) => unparsedRows(g, normalized)).slice(0, 40);
    return { teams: normalized, note, skipped };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось разобрать файл" };
  }
}

export type EnrichState = { teams?: TeamDraft[]; notes?: EnrichNote[]; error?: string } | null;

/**
 * Дотянуть данные из Steam и OpenDota по уже разобранному черновику. Отдельной кнопкой, а не внутри
 * разбора: это единственный шаг, ходящий в сеть, и он может занять минуту на большой файл.
 */
export async function enrichDrafts(_prev: EnrichState, form: FormData): Promise<EnrichState> {
  await requirePermission("tournaments.edit");
  try {
    const teams = JSON.parse(String(form.get("teams") ?? "[]")) as TeamDraft[];
    if (teams.length === 0) return { error: "Нечего обогащать" };
    const { teams: enriched, notes } = await enrichTeams(teams);
    return { teams: enriched, notes };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось подтянуть данные" };
  }
}

export type TeamResult = { team: string; ok: boolean; problems: Problem[] };
export type SaveState = { results?: TeamResult[]; error?: string } | null;

/**
 * Записать разобранное прямо в ростер. Черновик приезжает из превью — тем же JSON, что показали
 * оператору. По каждой команде отдаём отчёт: что записалось, а что остановили замечания.
 */
export async function saveDrafts(_prev: SaveState, form: FormData): Promise<SaveState> {
  await requirePermission("tournaments.edit");
  await requirePermission("roster.edit"); // запись идёт в ростер, а не в очередь
  try {
    const divisionRaw = String(form.get("divisionId") ?? "");
    const divisionId = divisionRaw ? Number(divisionRaw) : null;
    if (!divisionId) return { error: "Выберите дивизион — командам нужно куда встать" };

    const teams = JSON.parse(String(form.get("teams") ?? "[]")) as TeamDraft[];
    const picked = new Set(form.getAll("pick").map(String));
    const chosen = teams.filter((t) => picked.has(t.slug));
    if (chosen.length === 0) return { error: "Не отмечено ни одной команды" };

    const results: TeamResult[] = [];
    for (const team of chosen) {
      const problems = await applicationProblems(team, divisionId);
      if (problems.some((p) => p.level === "block")) {
        results.push({ team: team.name, ok: false, problems });
        continue;
      }
      await writeTeamToRoster(team, divisionId);
      results.push({ team: team.name, ok: true, problems });
    }

    revalidatePath(`/admin/tournaments/${String(form.get("tournamentSlug") ?? "")}`);
    revalidatePath("/roster/teams");
    return { results };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось записать составы" };
  }
}
