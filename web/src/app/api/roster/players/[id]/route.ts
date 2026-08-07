import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";
import { accountIdFromUrl, normalizeTelegram, parseBirthday } from "@/lib/profiles";

const TEXT_FIELDS = [
  "nickname", "realName", "photo", "steamUrl", "dotabuffUrl", "stratzUrl", "city", "country",
] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const body = (await req.json()) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  for (const f of TEXT_FIELDS) {
    if (f in body) data[f] = String(body[f] ?? "").trim() || null;
  }
  // account_id: в CRM это ссылка на стим-профиль, поэтому в поле принимаем и её.
  // Именной адрес /id/<vanity> без Steam API не разворачивается — говорим об этом прямо.
  if ("accountId" in body) {
    const raw = String(body.accountId ?? "").trim();
    if (raw === "") {
      data.accountId = null;
    } else {
      const accountId = accountIdFromUrl(raw);
      if (!accountId) {
        return bad(`Не разобрал «${raw}». Нужен account_id, ссылка на steamcommunity.com/profiles/… , Dotabuff или Stratz`);
      }
      data.accountId = accountId;
    }
  }

  if ("telegram" in body) {
    const raw = String(body.telegram ?? "").trim();
    if (raw === "") {
      data.telegram = null;
    } else {
      const handle = normalizeTelegram(raw);
      if (!handle) return bad(`«${raw}» не похоже на телеграм-хендл`);
      data.telegram = handle;
    }
  }

  if ("birthday" in body) {
    const raw = String(body.birthday ?? "").trim();
    if (raw === "") {
      data.birthday = null;
    } else {
      const date = parseBirthday(raw);
      if (!date) return bad(`Дата «${raw}» не разобрана — ждём 21.04.1998`);
      data.birthday = date;
    }
  }

  if ("mmr" in body) {
    // пустое поле = «не указан», а не ноль: нулевой MMR утянул бы вниз средний по команде
    const raw = String(body.mmr ?? "").trim();
    if (raw === "") {
      data.mmr = null;
    } else {
      const mmr = Number(raw);
      if (!Number.isFinite(mmr) || mmr < 0) {
        return bad(`MMR должен быть числом, а не «${raw}»`);
      }
      data.mmr = Math.round(mmr);
    }
  }
  if ("tp" in body) {
    // TP — сезонные очки MVP, оператор правит их вручную. Пустое поле = 0 (в отличие от MMR,
    // где пусто значит «не указан»): TP есть у всех, просто у большинства ноль.
    const raw = String(body.tp ?? "").trim();
    if (raw === "") {
      data.tp = 0;
    } else {
      const tp = Number(raw);
      if (!Number.isInteger(tp) || tp < 0) {
        return NextResponse.json({ error: `TP должны быть целым числом ≥ 0, а не «${raw}»` }, { status: 400 });
      }
      data.tp = tp;
    }
  }
  // Роль, капитанство и команда — это место в составе, они правятся через /api/roster/spots.
  if (data.nickname === null) return bad("Ник не может быть пустым");

  const { count } = await prisma.player.updateMany({ where: { id }, data });
  if (!count) return bad("Игрок не найден", 404);
  return NextResponse.json(await prisma.player.findUnique({ where: { id } }));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const playerId = parseId((await params).id);
  if (!playerId) return bad("id: ожидался числовой id");

  // Игрока со статой не удаляем — на него ссылается MatchStat (история матчей).
  const stats = await prisma.matchStat.count({ where: { playerId } });
  if (stats > 0) {
    return bad(`У игрока стата по ${stats} матч(ам) — удаление сломает историю`, 409);
  }

  const { count } = await prisma.player.deleteMany({ where: { id: playerId } });
  if (!count) return bad("Игрок не найден", 404);
  return NextResponse.json({ ok: true });
}
