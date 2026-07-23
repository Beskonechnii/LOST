import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accountIdFromUrl, normalizeTelegram, parseBirthday } from "@/lib/profiles";

const TEXT_FIELDS = [
  "nickname", "realName", "photo", "steamUrl", "dotabuffUrl", "stratzUrl", "city", "country",
] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
      const id = accountIdFromUrl(raw);
      if (!id) {
        return NextResponse.json(
          { error: `Не разобрал «${raw}». Нужен account_id, ссылка на steamcommunity.com/profiles/… , Dotabuff или Stratz` },
          { status: 400 },
        );
      }
      data.accountId = id;
    }
  }

  if ("telegram" in body) {
    const raw = String(body.telegram ?? "").trim();
    if (raw === "") {
      data.telegram = null;
    } else {
      const handle = normalizeTelegram(raw);
      if (!handle) return NextResponse.json({ error: `«${raw}» не похоже на телеграм-хендл` }, { status: 400 });
      data.telegram = handle;
    }
  }

  if ("birthday" in body) {
    const raw = String(body.birthday ?? "").trim();
    if (raw === "") {
      data.birthday = null;
    } else {
      const date = parseBirthday(raw);
      if (!date) return NextResponse.json({ error: `Дата «${raw}» не разобрана — ждём 21.04.1998` }, { status: 400 });
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
        return NextResponse.json({ error: `MMR должен быть числом, а не «${raw}»` }, { status: 400 });
      }
      data.mmr = Math.round(mmr);
    }
  }
  // Роль, капитанство и команда — это место в составе, они правятся через /api/roster/spots.
  if (data.nickname === null) return NextResponse.json({ error: "Ник не может быть пустым" }, { status: 400 });

  const player = await prisma.player.update({ where: { id: Number(id) }, data });
  return NextResponse.json(player);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = Number(id);

  // Игрока со статой не удаляем — на него ссылается MatchStat (история матчей).
  const stats = await prisma.matchStat.count({ where: { playerId } });
  if (stats > 0) {
    return NextResponse.json({ error: `У игрока стата по ${stats} матч(ам) — удаление сломает историю` }, { status: 409 });
  }

  await prisma.player.delete({ where: { id: playerId } });
  return NextResponse.json({ ok: true });
}
