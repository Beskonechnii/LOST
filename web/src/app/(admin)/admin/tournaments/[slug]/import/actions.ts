"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/account";
import { createApplications } from "@/lib/team-application";
import { normalizeDrafts, parseDelimited, parseGrid, type TeamDraft } from "@/lib/roster-import";
import { readWorkbook } from "@/lib/xlsx";

// Импорт составов: разбор — отдельным шагом от записи (TOURNAMENTS-PLAN.md §2.4). Сначала оператор
// видит, что разобралось, и только потом заводятся заявки: файл из чужих рук — это всегда сюрприз,
// а откатывать запись по дюжине команд нечем.

export type ParseState = { teams?: TeamDraft[]; error?: string; note?: string } | null;

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

    if (file instanceof File && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (/\.xlsx$/i.test(file.name)) {
        const sheets = readWorkbook(bytes).filter((s) => !sheetFilter || s.name.toLowerCase().includes(sheetFilter));
        teams = sheets.flatMap((s) => parseGrid(s.grid));
        note = `Листы: ${sheets.map((s) => s.name).join(", ") || "не нашлось"}`;
      } else {
        teams = parseGrid(parseDelimited(new TextDecoder().decode(bytes)));
        note = `Файл ${file.name}`;
      }
    } else if (link) {
      const sheets = readWorkbook(await fetchSheet(link)).filter(
        (s) => !sheetFilter || s.name.toLowerCase().includes(sheetFilter),
      );
      teams = sheets.flatMap((s) => parseGrid(s.grid));
      note = `Листы: ${sheets.map((s) => s.name).join(", ") || "не нашлось"}`;
    } else if (pasted) {
      teams = parseGrid(parseDelimited(pasted));
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
    return { teams: normalized, note };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось разобрать файл" };
  }
}

export type SaveState = { created?: number; error?: string } | null;

/** Записать разобранное в очередь заявок. Черновик приезжает из превью — тем же JSON, что показали. */
export async function saveDrafts(_prev: SaveState, form: FormData): Promise<SaveState> {
  await requirePermission("tournaments.edit");
  try {
    const tournamentId = Number(form.get("tournamentId"));
    const divisionRaw = String(form.get("divisionId") ?? "");
    const divisionId = divisionRaw ? Number(divisionRaw) : null;
    const teams = JSON.parse(String(form.get("teams") ?? "[]")) as TeamDraft[];
    const picked = new Set(form.getAll("pick").map(String));
    const chosen = teams.filter((t) => picked.has(t.slug));
    if (chosen.length === 0) return { error: "Не отмечено ни одной команды" };

    const created = await createApplications(tournamentId, divisionId, chosen);
    revalidatePath(`/admin/tournaments/${String(form.get("tournamentSlug") ?? "")}/registrations`);
    return { created };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось создать заявки" };
  }
}
