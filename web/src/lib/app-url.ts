// Только сервер: базовый адрес приложения для абсолютных ссылок в письмах. Берём APP_URL, а когда
// он не задан — собираем из заголовков запроса (host + протокол). За прокси/туннелем origin запроса
// может врать — тогда APP_URL и нужен (как GOOGLE_REDIRECT_URI для OAuth).

import "server-only";
import { headers } from "next/headers";

export async function appUrl(): Promise<string> {
  const env = (process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (env) return env;
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}
