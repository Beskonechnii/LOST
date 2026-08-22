// Разбор таблицы с составами → черновик заявок команд. Чистый модуль (без БД и next/headers):
// его зовут страница импорта в админке, разовые скрипты и — когда появится — телеграм-бот.
// Один парсер на все входы: к третьему входу три разных представления о том, что такое «состав»
// разъедутся гарантированно (TOURNAMENTS-PLAN.md §2.5).
//
// Понимаем две раскладки, потому что таблицы приходят двух видов:
//   • колоночная — шапка с названиями столбцов («Команда | Ник | Роль | MMR | Ссылка»), одна строка
//     = один игрок. Так выглядит почти всё, что присылают организаторы;
//   • блочная — как в сезонной таблице LOST: строка с номером и названием команды, под ней шапка
//     «Роль | ИНФ | MMR» и строки игроков, имя в формате «Имя "Ник" Фамилия».
// Какая именно пришла, решает `parseGrid`: сначала пробует найти шапку, иначе идёт по блокам.

import { slugify, accountIdFromUrl, normalizeTelegram } from "./profiles";
import { roleByPosition, isRole, type RoleKey } from "./roles";
import type { Grid, Cell } from "./xlsx";

export type PlayerDraft = {
  nickname: string;
  realName: string | null;
  role: RoleKey | null;
  mmr: number | null;
  accountId: string | null;
  dotabuffUrl: string | null;
  stratzUrl: string | null;
  steamUrl: string | null;
  telegram: string | null;
  isCaptain: boolean;
  /** Подтянутое из OpenDota (src/lib/enrich.ts) — в заявке живёт как справка. */
  rank?: number | null;
  /** Ник в клиенте Доты: не переписываем им заявку, но расхождение показываем оператору. */
  dotaName?: string | null;
  /** Аватар Steam — только для превью: Player.photo у нас всегда локальный файл. */
  avatar?: string | null;
};

export type TeamDraft = {
  slug: string;
  name: string;
  tag: string | null;
  players: PlayerDraft[];
};

export const emptyPlayer = (nickname: string): PlayerDraft => ({
  nickname,
  realName: null,
  role: null,
  mmr: null,
  accountId: null,
  dotabuffUrl: null,
  stratzUrl: null,
  steamUrl: null,
  telegram: null,
  isCaptain: false,
});

// ── мелкая нормализация ──────────────────────────────────────────────────────

/** Числа в xlsx приходят как «1.0», а MMR люди пишут как «5 200» и «5,2k». */
export function parseMmr(raw: string): number | null {
  const s = raw.toLowerCase().replace(/\s| /g, "");
  const k = s.match(/^(\d+([.,]\d+)?)k$/);
  if (k) return Math.round(Number(k[1].replace(",", ".")) * 1000);
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Роль из ячейки: позиция 1–5, ключ роли или слово. Регистр и падеж не должны решать, тренер
 * человек или замена, поэтому сравниваем по началу слова.
 */
export function parseRole(raw: string): RoleKey | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const pos = s.match(/^([1-5])\b/);
  if (pos) return roleByPosition(Number(pos[1]));
  if (isRole(s)) return s;
  if (s.startsWith("трен") || s.startsWith("coach")) return "coach";
  if (s.startsWith("зам") || s.startsWith("стенд") || s.startsWith("stand")) return "standin";
  if (s.startsWith("керри") || s.startsWith("carry")) return "carry";
  if (s.startsWith("мид") || s.startsWith("mid")) return "mid";
  if (s.startsWith("офф") || s.startsWith("off")) return "offlane";
  if (s.startsWith("саппорт 4") || s.startsWith("софт")) return "soft-support";
  if (s.startsWith("саппорт") || s.startsWith("support") || s.startsWith("хард")) return "hard-support";
  return null;
}

/** «Название (ТЕГ)» → имя и тег. */
export function splitTeamName(raw: string): { name: string; tag: string | null } {
  const m = raw.match(/^(.*?)\s*[([]([^)\]]+)[)\]]\s*$/);
  return m ? { name: m[1].trim(), tag: m[2].trim() } : { name: raw.trim(), tag: null };
}

/** «Имя "Ник" Фамилия» → ник и настоящее имя; без кавычек — вся ячейка это ник. */
export function splitPlayerName(raw: string): { nickname: string; realName: string | null } | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^(.*?)["“«]([^"”»]+)["”»](.*)$/);
  if (!m) return { nickname: s, realName: null };
  const nickname = m[2].trim();
  if (!nickname) return null;
  return { nickname, realName: `${m[1].trim()} ${m[3].trim()}`.replace(/\s+/g, " ").trim() || null };
}

/** Ссылка на профиль в нужное поле игрока. Чужие адреса игнорируем — пусть лучше поле пустует. */
export function applyLink(player: PlayerDraft, href: string) {
  const url = href.trim();
  if (!/^https?:/i.test(url)) return;
  if (/dotabuff\.com/i.test(url)) player.dotabuffUrl ??= url;
  else if (/stratz\.com/i.test(url)) player.stratzUrl ??= url;
  else if (/steamcommunity\.com/i.test(url)) player.steamUrl ??= url;
  else if (/t\.me|telegram\./i.test(url)) player.telegram ??= normalizeTelegram(url);
  else return;
  player.accountId ??= accountIdFromUrl(url);
}

// ── колоночная раскладка ─────────────────────────────────────────────────────

type Column =
  | "team"
  | "tag"
  | "nickname"
  | "realName"
  | "role"
  | "mmr"
  | "link"
  | "telegram"
  | "captain";

/** Синонимы шапки. Порядок важен: «команда» проверяется раньше «тег», иначе «тег команды» уедет не туда. */
const HEADERS: [Column, RegExp][] = [
  ["team", /^(команда|team|название команды|клуб)/i],
  ["tag", /^(тег|тэг|tag|аббрев)/i],
  ["nickname", /^(ник|nick|nickname|игрок|player|никнейм)/i],
  ["realName", /^(имя|фио|real ?name|name)/i],
  ["role", /^(роль|позиция|position|role|поз\.?)/i],
  ["mmr", /^(mmr|ммр|рейтинг|ранг)/i],
  ["link", /^(ссылка|профиль|dotabuff|stratz|steam|link|profile)/i],
  ["telegram", /^(телеграм|telegram|тг|tg)/i],
  ["captain", /^(капитан|captain|кэп)/i],
];

const columnOf = (title: string): Column | null =>
  HEADERS.find(([, re]) => re.test(title.trim()))?.[0] ?? null;

/** Строка-шапка: в ней узнаются и «команда», и «ник» — по одному совпадению шапку не объявляем. */
function findHeader(grid: Grid): { row: number; map: Map<Column, number[]> } | null {
  for (let r = 0; r < Math.min(grid.length, 30); r++) {
    const row = grid[r];
    if (!row) continue;
    const map = new Map<Column, number[]>();
    row.forEach((cell, i) => {
      const col = cell?.text ? columnOf(cell.text) : null;
      if (!col) return;
      map.set(col, [...(map.get(col) ?? []), i]);
    });
    if (map.has("team") && map.has("nickname")) return { row: r, map };
  }
  return null;
}

const yes = (raw: string) => /^(да|yes|true|1|\+|капитан|c|к)$/i.test(raw.trim());

function parseColumns(grid: Grid, header: { row: number; map: Map<Column, number[]> }): TeamDraft[] {
  const teams: TeamDraft[] = [];
  const byName = new Map<string, TeamDraft>();
  const at = (row: Cell[], col: Column) => {
    for (const i of header.map.get(col) ?? []) {
      const text = row[i]?.text?.trim();
      if (text) return text;
    }
    return "";
  };

  for (let r = header.row + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;

    // Название команды тянется сверху вниз: в таких таблицах его пишут один раз на блок.
    const teamName = at(row, "team");
    const nick = at(row, "nickname");
    if (!teamName && !nick) continue;

    // Ключ команды — слаг её имени БЕЗ тега: «Тест (T1)» в первой строке и «Тест» в остальных —
    // одна и та же команда, а не две. По сырой ячейке они бы разъехались.
    const parsedTeam = teamName ? splitTeamName(teamName) : null;
    const key = parsedTeam ? slugify(parsedTeam.name) || parsedTeam.name.toLowerCase() : "";
    let team = key ? byName.get(key) : teams[teams.length - 1];
    if (parsedTeam && !team) {
      team = { slug: slugify(parsedTeam.name), name: parsedTeam.name, tag: at(row, "tag") || parsedTeam.tag, players: [] };
      byName.set(key, team);
      teams.push(team);
    }
    // Тег могли написать только во второй строке блока — дозаполняем, если раньше его не было.
    if (team && parsedTeam && !team.tag) team.tag = at(row, "tag") || parsedTeam.tag;
    if (!team || !nick) continue;

    if (BLOCK_HEADERS.test(nick)) continue; // повторённая шапка посреди листа
    const parsed = splitPlayerName(nick);
    if (!parsed) continue;
    const player = emptyPlayer(parsed.nickname);
    player.realName = at(row, "realName") || parsed.realName;
    player.role = parseRole(at(row, "role"));
    player.mmr = parseMmr(at(row, "mmr"));
    player.isCaptain = yes(at(row, "captain"));
    const tg = at(row, "telegram");
    if (tg) player.telegram = normalizeTelegram(tg);

    // Ссылки берём и из текста ячеек, и из гиперссылок: в выгрузках встречается и то, и другое,
    // причём в колонке «ссылка» часто лежит подпись «Dotabuff», а сам адрес — в href.
    for (const cell of row) {
      if (!cell) continue;
      if (cell.href) applyLink(player, cell.href);
      if (/^https?:/i.test(cell.text)) applyLink(player, cell.text);
    }
    team.players.push(player);
  }
  return teams;
}

// ── блочная раскладка (таблица сезона LOST) ──────────────────────────────────

/**
 * Слова шапки внутри блока. В сезонной таблице LOST шапка блока — «Роль | ИНФ | MMR», но колонки
 * в разных таблицах сдвинуты, и проверять одну ячейку мало: строка «ИНФ» уезжала в состав игроком
 * с ником «ИНФ». Поэтому шапкой считаем строку, где узнаётся любое из этих слов.
 */
const BLOCK_HEADERS = /^(роль|инф|инфо|mmr|ммр|ник|игрок|имя|позиция|поз\.?|ссылка|профиль|№|n|номер|телеграм|tg|капитан)$/i;

const isHeaderRow = (row: Cell[]) => row.some((c) => c?.text && BLOCK_HEADERS.test(c.text.trim()));

function parseBlocks(grid: Grid): TeamDraft[] {
  const teams: TeamDraft[] = [];
  let current: TeamDraft | null = null;
  const int = (s: string) => (/^\d+(\.0+)?$/.test(s) ? String(Number(s)) : s);

  for (const row of grid) {
    if (!row) continue;
    const cell = (i: number) => int(row[i]?.text ?? "");

    // начало блока: номер команды во второй колонке и её название в четвёртой (не число)
    if (/^\d+$/.test(cell(1)) && cell(3) && !/^\d+$/.test(cell(3))) {
      const { name, tag } = splitTeamName(cell(3));
      current = { slug: slugify(name), name, tag, players: [] };
      teams.push(current);
      continue;
    }
    if (!current) continue;

    if (isHeaderRow(row)) continue; // шапка блока, а не игрок
    const role = cell(3);
    const parsed = cell(4) ? splitPlayerName(cell(4)) : null;
    if (!parsed) continue;

    const player = emptyPlayer(parsed.nickname);
    player.realName = parsed.realName;
    player.role = parseRole(role) ?? "standin"; // пустая роль в этой таблице означает замену
    player.mmr = parseMmr(cell(6));
    for (const c of row) {
      if (c?.href) applyLink(player, c.href);
    }
    current.players.push(player);
  }
  return teams;
}

// ── построчный разбор («ник; роль; MMR; ссылка») ─────────────────────────────

/**
 * Состав, присланный сообщением: строка = игрок, а порядок колонок — как получится. Именно так
 * составы чаще всего и приходят капитану в личку, поэтому разбираем не по позициям, а по смыслу
 * ячейки: адрес — ссылка, «1»–«5» или слово — роль, число подходящего порядка — MMR, «@…» —
 * телеграм, остальное — ник (и настоящее имя, если оно рядом в кавычках).
 *
 * Отдельно от табличных раскладок: там смысл колонки задаёт шапка, а здесь её нет вовсе.
 */
export function parsePlayerLines(text: string): PlayerDraft[] {
  const players: PlayerDraft[] = [];

  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const cells = raw.split(/[;|\t]|,(?=\s)/).map((c) => c.trim()).filter(Boolean);
    if (cells.length === 0) continue;

    const player = emptyPlayer("");
    const leftovers: string[] = [];

    for (const cell of cells) {
      if (/^https?:\/\//i.test(cell) || /^(www\.)?(dotabuff|stratz|steamcommunity)\./i.test(cell)) {
        applyLink(player, /^https?:/i.test(cell) ? cell : `https://${cell}`);
        continue;
      }
      if (/^@/.test(cell)) {
        player.telegram ??= normalizeTelegram(cell);
        continue;
      }
      const role = parseRole(cell);
      if (role && !player.role && !/^\d{3,}/.test(cell)) {
        player.role = role;
        continue;
      }
      const mmr = /^[\d\s.,k]+$/i.test(cell) ? parseMmr(cell) : null;
      if (mmr && mmr >= 500 && !player.mmr) {
        player.mmr = mmr;
        continue;
      }
      leftovers.push(cell);
    }

    const named = leftovers.length ? splitPlayerName(leftovers[0]) : null;
    if (!named) continue; // строка без имени — это шапка или мусор, а не игрок
    player.nickname = named.nickname;
    player.realName = named.realName ?? leftovers[1] ?? null;
    players.push(player);
  }

  return players;
}

// ── вход ─────────────────────────────────────────────────────────────────────

/**
 * Разбор одного листа. Пробуем **обе** раскладки и берём ту, где игроков вышло больше.
 *
 * Раньше выбор был по наличию шапки: нашлись слова «Команда» и «Ник» — значит таблица колоночная.
 * На сезонной таблице LOST это подводило: там блочная раскладка, но слова из шапки в листе тоже
 * встречаются, и колоночный разбор молча забирал только часть игроков. Сравнить два результата
 * дешевле, чем угадывать по одному признаку.
 */
export function parseGrid(grid: Grid): TeamDraft[] {
  return parseGridDetailed(grid).teams;
}

export type GridReport = {
  /** Какая раскладка победила — оператору это подсказка, куда смотреть, если игроки потерялись. */
  layout: "columns" | "blocks" | "empty";
  teams: TeamDraft[];
  /** Сколько игроков дала каждая раскладка — видно, что вторая была близка (или не нашла ничего). */
  columnsPlayers: number;
  blocksPlayers: number;
};

/** Тот же разбор, но с отчётом: чем закончилась каждая раскладка. */
export function parseGridDetailed(grid: Grid): GridReport {
  const header = findHeader(grid);
  const columns = header ? parseColumns(grid, header) : [];
  const blocks = parseBlocks(grid);
  const size = (teams: TeamDraft[]) => teams.reduce((n, t) => n + t.players.length, 0);
  const columnsPlayers = size(columns);
  const blocksPlayers = size(blocks);
  const teams = columnsPlayers >= blocksPlayers ? columns : blocks;
  return {
    layout: teams.length === 0 ? "empty" : columnsPlayers >= blocksPlayers ? "columns" : "blocks",
    teams,
    columnsPlayers,
    blocksPlayers,
  };
}

/**
 * Строки листа, которые не попали ни в одну команду. Оператору важно видеть не только то, что
 * разобралось, но и то, что потерялось: «22 игрока» без этого списка выглядят как успех, даже если
 * в таблице их было тридцать.
 */
export function unparsedRows(grid: Grid, teams: TeamDraft[]): string[] {
  const known = new Set<string>();
  for (const t of teams) {
    known.add(t.name.toLowerCase());
    for (const p of t.players) {
      known.add(p.nickname.toLowerCase());
      if (p.realName) known.add(p.realName.toLowerCase());
    }
  }

  const out: string[] = [];
  for (const row of grid) {
    if (!row) continue;
    const text = row.map((c) => c?.text ?? "").filter(Boolean).join(" · ").trim();
    if (!text || text.length < 3) continue;
    // Шапку за потерянную строку не считаем: она и не должна была стать игроком.
    const headerCells = row.filter((c) => c?.text && columnOf(c.text)).length;
    if (headerCells >= 2) continue;
    // Строка считается разобранной, если хоть одна её ячейка узнаётся как имя команды или игрока.
    const seen = row.some((c) => {
      const v = c?.text?.trim().toLowerCase();
      if (!v) return false;
      return known.has(v) || [...known].some((k) => k.length > 2 && v.includes(k));
    });
    if (!seen) out.push(text);
  }
  return out;
}

/**
 * CSV/TSV в сетку. Разделитель угадываем по первой строке: у нас в ходу и запятая, и точка с
 * запятой (Excel в русской локали), и таб. Кавычки — по правилу csv («""» внутри поля).
 */
export function parseDelimited(text: string): Grid {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const first = clean.split("\n")[0] ?? "";
  const sep = [";", "\t", ","].sort((a, b) => first.split(b).length - first.split(a).length)[0];

  const grid: Grid = [];
  let row: Cell[] = [];
  let field = "";
  let quoted = false;
  const pushField = () => {
    row.push({ text: field.trim(), href: null });
    field = "";
  };
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === sep) pushField();
    else if (ch === "\n") { pushField(); grid.push(row); row = []; }
    else field += ch;
  }
  pushField();
  if (row.some((c) => c.text)) grid.push(row);
  return grid;
}

/**
 * Свести разобранное: пустые команды выкидываем, одинаковые слаги разводим суффиксом. Слаг — ключ
 * импорта и имя файла ассета, две команды с одним слагом затрут друг другу лого.
 */
export function normalizeDrafts(teams: TeamDraft[]): TeamDraft[] {
  const out = teams.filter((t) => t.name.trim() && t.players.length > 0);
  const seen = new Set<string>();
  for (const t of out) {
    t.slug = t.slug || slugify(t.name);
    if (!t.slug) t.slug = `team-${seen.size + 1}`;
    let slug = t.slug;
    for (let i = 2; seen.has(slug); i++) slug = `${t.slug}-${i}`;
    t.slug = slug;
    seen.add(slug);
  }
  return out;
}
