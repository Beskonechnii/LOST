// Только сервер / скрипт: отправка в Telegram через Bot API. Часть пайплайна авто-инфографики (1.1):
// рендер карты (render-png.ts) → фото сюда. Токен и чат берём из окружения — в код/коммит не кладём.
//
// .env:
//   TG_BOT_TOKEN=123456:ABC...   токен бота от @BotFather
//   TG_CHAT_ID=123456789         куда слать (свой user id, id канала или группы)
//
// Токен — это credential: заводит его владелец бота, скрипт лишь читает из .env. Без него функции
// бросают понятную ошибку, а пайплайн всё равно сохраняет PNG на диск (см. send-infographic.ts).

function creds(): { token: string; chatId: string } {
  const token = process.env.TG_BOT_TOKEN?.trim();
  const chatId = process.env.TG_CHAT_ID?.trim();
  if (!token || !chatId) {
    throw new Error("Нет TG_BOT_TOKEN / TG_CHAT_ID в .env — заведи бота у @BotFather и впиши их.");
  }
  return { token, chatId };
}

/** Есть ли настройки для отправки — чтобы пайплайн решал, слать или только сохранить на диск. */
export const telegramConfigured = (): boolean => !!(process.env.TG_BOT_TOKEN && process.env.TG_CHAT_ID);

/** Отправить PNG как фото с подписью. Бросает при ошибке сети или Bot API. */
export async function sendPhoto(png: Buffer, caption = ""): Promise<void> {
  const { token, chatId } = creds();
  const form = new FormData();
  form.set("chat_id", chatId);
  if (caption) {
    form.set("caption", caption);
    form.set("parse_mode", "HTML");
  }
  form.set("photo", new Blob([new Uint8Array(png)], { type: "image/png" }), "match.png");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
  const json = (await res.json()) as { ok: boolean; description?: string };
  if (!json.ok) throw new Error(`Telegram отказал: ${json.description ?? res.status}`);
}

/** Отправить текстовое сообщение (для служебных уведомлений). */
export async function sendMessage(text: string): Promise<void> {
  const { token, chatId } = creds();
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  const json = (await res.json()) as { ok: boolean; description?: string };
  if (!json.ok) throw new Error(`Telegram отказал: ${json.description ?? res.status}`);
}
