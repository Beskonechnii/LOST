// Только сервер: гейт API-роута по гранулярному праву.
//
// Зачем отдельным файлом, а не в lib/api.ts: тот — чистые мелочи формата ответа, его можно тянуть
// откуда угодно, а здесь под капотом БД и куки (account.ts помечен server-only).
//
// proxy проверяет лишь роль («вообще админ ли») и общий запрет не-GET к /api. Право конкретного
// действия проверяется здесь: до роута доходят не только наши формы, страницу можно и не открывать.
// Ответ — 403 в том же виде `{ error }`, что и остальные ошибки API: формы показывают его как есть.

import { NextResponse } from "next/server";
import { can } from "./account";
import { permissionLabel, type PermissionKey } from "./permissions";

/** null — право есть, иначе готовый 403. Использование: `const denied = await guard("roster.edit"); if (denied) return denied;` */
export async function guard(key: PermissionKey): Promise<NextResponse | null> {
  if (await can(key)) return null;
  return NextResponse.json({ error: `Нужно право «${permissionLabel(key)}» — попросите владельца лиги` }, { status: 403 });
}
