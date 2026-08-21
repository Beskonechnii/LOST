// Только сервер: заявки команд — от разбора файла до апрува, который заводит их в ростер.
//
// Заявка хранит состав целиком JSON'ом в `TeamApplication.payload`, а `Team`/`Player`/`RosterSpot`
// появляются только в момент одобрения. Причина та же, что у анкеты игрока (ACCOUNTS-PLAN.md §2.1):
// публичные витрины читают ростер без фильтров, и залитый сразу кривой файл на дюжину команд
// немедленно виден на /roster/teams, а откатить его нечем.
//
// Всё, что могло бы удивить оператора при записи (игрок уже действующий в другой команде дивизиона,
// один account_id под двумя никами, занятый слаг), считается ДО апрува — `applicationProblems`.

import { prisma } from "./prisma";
import { slugify, playerAccountId } from "./profiles";
import { isCoreRole, spotConflict } from "./roster-spots";
import { setTeamDivision } from "./tournaments";
import type { TeamDraft, PlayerDraft } from "./roster-import";

export type { TeamDraft, PlayerDraft };

/** JSON payload заявки. Версия — чтобы старую заявку можно было прочитать после смены формата. */
type Payload = { version: 1; team: TeamDraft };

export const formatDraft = (team: TeamDraft): string => JSON.stringify({ version: 1, team } satisfies Payload);

/** Битый payload — не повод падать всей очередью: заявка покажется пустой, оператор её вернёт. */
export function parseDraft(raw: string | null | undefined): TeamDraft | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Payload;
    return data?.team?.name ? data.team : null;
  } catch {
    return null;
  }
}

// ── очередь ──────────────────────────────────────────────────────────────────

export const listApplications = (tournamentId: number) =>
  prisma.teamApplication.findMany({
    where: { tournamentId },
    orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
    include: { division: true, team: true },
  });

export type ApplicationRow = Awaited<ReturnType<typeof listApplications>>[number];

/** Завести заявки из разбора файла. Возвращает, сколько создано — оператор видит это в отчёте. */
export async function createApplications(
  tournamentId: number,
  divisionId: number | null,
  teams: TeamDraft[],
  source = "import",
) {
  for (const team of teams) {
    await prisma.teamApplication.create({
      data: { tournamentId, divisionId, source, payload: formatDraft(team) },
    });
  }
  return teams.length;
}

// ── проверки до записи ───────────────────────────────────────────────────────

export type Problem = { level: "block" | "warn" | "info"; text: string };

/**
 * Что не так с заявкой. `block` не даёт апрувить (данные развалят ростер), `warn` — на усмотрение
 * оператора, `info` — просто «вот что произойдёт при записи».
 */
export async function applicationProblems(team: TeamDraft, divisionName: string | null): Promise<Problem[]> {
  const problems: Problem[] = [];

  const existingTeam = await prisma.team.findUnique({ where: { slug: team.slug } });
  if (existingTeam)
    problems.push({
      level: "info",
      text: `Слаг «${team.slug}» занят командой «${existingTeam.name}» — состав допишется к ней, новая заведена не будет`,
    });

  if (team.players.length === 0) problems.push({ level: "block", text: "В заявке нет игроков" });
  const core = team.players.filter((p) => isCoreRole(p.role)).length;
  if (core < 5)
    problems.push({ level: "warn", text: `Основы меньше пяти: позиций 1–5 заполнено ${core}` });

  // Дубли внутри самой заявки: один человек под двумя никами — ошибка составителя, а не лиги.
  const seenIds = new Map<string, string>();
  const seenNicks = new Set<string>();
  for (const p of team.players) {
    const nick = p.nickname.toLowerCase();
    if (seenNicks.has(nick)) problems.push({ level: "block", text: `Ник «${p.nickname}» в заявке дважды` });
    seenNicks.add(nick);
    const id = p.accountId;
    if (!id) continue;
    const prev = seenIds.get(id);
    if (prev) problems.push({ level: "block", text: `Один account_id ${id} у «${prev}» и «${p.nickname}»` });
    seenIds.set(id, p.nickname);
  }

  for (const p of team.players) {
    if (!p.accountId && !p.dotabuffUrl && !p.stratzUrl && !p.steamUrl)
      problems.push({ level: "warn", text: `«${p.nickname}»: нет ни одной ссылки на профиль — в архиве матчей его не опознать` });
    if (!p.role) problems.push({ level: "warn", text: `«${p.nickname}»: не разобрана роль` });
  }

  // Конфликт составов: действующим можно быть только в одной команде дивизиона (roster-spots.ts).
  for (const p of team.players) {
    if (!isCoreRole(p.role)) continue;
    const found = await findPlayer(p);
    if (!found) continue;
    const spots = await prisma.rosterSpot.findMany({
      where: { playerId: found.id },
      include: { team: { select: { id: true, name: true, group: true } } },
    });
    const conflict = spotConflict(
      spots
        .filter((s) => s.team.id !== existingTeam?.id)
        .map((s) => ({ teamId: s.team.id, role: s.role, division: s.team.group, teamName: s.team.name })),
      { teamId: existingTeam?.id ?? -1, role: p.role, division: divisionName },
    );
    if (conflict) problems.push({ level: "block", text: `«${p.nickname}»: ${conflict}` });
  }

  return problems;
}

/**
 * Игрок ростера, соответствующий строке заявки. Сначала по account_id (он не меняется, в отличие от
 * ника), потом по слагу ника — так заявка на уже заведённого человека не плодит второй профиль.
 * `playerAccountId` смотрит и в поле, и в ссылки на профиль — id часто лежит только в них.
 */
async function findPlayer(draft: PlayerDraft) {
  if (draft.accountId) {
    const all = await prisma.player.findMany({
      where: {
        OR: [
          { accountId: draft.accountId },
          { dotabuffUrl: { contains: draft.accountId } },
          { stratzUrl: { contains: draft.accountId } },
          { steamUrl: { contains: draft.accountId } },
        ],
      },
    });
    const exact = all.find((p) => playerAccountId(p) === draft.accountId);
    if (exact) return exact;
  }
  const slug = slugify(draft.nickname);
  return slug ? prisma.player.findUnique({ where: { slug } }) : null;
}

/** Свободный слаг игрока: ник занят — добавляем суффикс. Слаг ставится один раз и не меняется. */
async function freePlayerSlug(nickname: string) {
  const base = slugify(nickname) || "player";
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (!(await prisma.player.findUnique({ where: { slug } }))) return slug;
  }
}

// ── апрув и возврат ──────────────────────────────────────────────────────────

/**
 * Одобрить заявку: завести (или дополнить) команду, игроков и состав, поставить команду в дивизион.
 * Право проверяет вызывающий (server-action): сюда БД-гарды не тянем — модуль зовут и скрипты.
 *
 * MMR из заявки пишем только новым игрокам и только как заявленный: у существующего профиля цифру
 * ставил оператор, и чужая таблица не должна её перебивать (то же правило, что в анкете кабинета).
 */
export async function approveApplication(applicationId: number, reviewerId: number | null) {
  const application = await prisma.teamApplication.findUnique({
    where: { id: applicationId },
    include: { division: true },
  });
  if (!application) throw new Error("Заявка не найдена");
  if (application.status === "approved") throw new Error("Заявка уже одобрена");
  const draft = parseDraft(application.payload);
  if (!draft) throw new Error("Заявка пустая или битая — верните её с причиной");
  if (!application.divisionId) throw new Error("Сначала выберите дивизион для команды");

  const team =
    (await prisma.team.findUnique({ where: { slug: draft.slug } })) ??
    (await prisma.team.create({ data: { slug: draft.slug, name: draft.name, tag: draft.tag } }));

  for (const p of draft.players) {
    const existing = await findPlayer(p);
    const player =
      existing ??
      (await prisma.player.create({
        data: {
          slug: await freePlayerSlug(p.nickname),
          nickname: p.nickname,
          realName: p.realName,
          accountId: p.accountId,
          mmr: p.mmr,
          dotabuffUrl: p.dotabuffUrl,
          stratzUrl: p.stratzUrl,
          steamUrl: p.steamUrl,
          telegram: p.telegram,
        },
      }));

    // Ссылки и account_id дописываем и существующему: пустое поле заполнить полезно, заполненное
    // не трогаем — там могла быть ручная правка оператора.
    if (existing) {
      await prisma.player.update({
        where: { id: existing.id },
        data: {
          accountId: existing.accountId ?? p.accountId,
          dotabuffUrl: existing.dotabuffUrl ?? p.dotabuffUrl,
          stratzUrl: existing.stratzUrl ?? p.stratzUrl,
          steamUrl: existing.steamUrl ?? p.steamUrl,
          telegram: existing.telegram ?? p.telegram,
        },
      });
    }

    await prisma.rosterSpot.upsert({
      where: { teamId_playerId: { teamId: team.id, playerId: player.id } },
      create: { teamId: team.id, playerId: player.id, role: p.role, isCaptain: p.isCaptain },
      update: { role: p.role, isCaptain: p.isCaptain },
    });
  }

  await setTeamDivision(team.id, application.divisionId);

  return prisma.teamApplication.update({
    where: { id: applicationId },
    data: { status: "approved", teamId: team.id, reviewedAt: new Date(), reviewedById: reviewerId, notes: null },
  });
}

/** Вернуть заявку с причиной. Причина обязательна: «отклонено» без объяснения нечего исправлять. */
export async function rejectApplication(applicationId: number, reason: string, reviewerId: number | null) {
  const notes = reason.trim();
  if (!notes) throw new Error("Укажите причину возврата");
  return prisma.teamApplication.update({
    where: { id: applicationId },
    data: { status: "rejected", notes, reviewedAt: new Date(), reviewedById: reviewerId },
  });
}

/** Удалить заявку целиком — для мусора, залитого не тем файлом. */
export const deleteApplication = (id: number) => prisma.teamApplication.delete({ where: { id } });
