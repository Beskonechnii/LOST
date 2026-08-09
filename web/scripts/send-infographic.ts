import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderUrlToPng } from "@/lib/render-png";
import { telegramConfigured, sendPhoto } from "@/lib/telegram";

// Пайплайн выгрузки инфографики (1.1): страница → PNG (headless-браузер) → на диск и в Telegram.
// Ручной запуск; авто-триггер «после репарсинга карты» навесится сверху, когда решим, откуда
// дёргать (webhook OpenDota / крон опроса архива).
//
// Флаги:
//   --url <адрес>       что рендерить. Для инфографики матча — ПУБЛИЧНАЯ страница (напр.
//                       http://localhost:3000/series/<slug>): страницы под /studio и /match
//                       за паролем, headless-браузер упрётся в логин.
//   --selector <css>    снять один элемент, а не весь экран (например «голый» холст рендера).
//   --w / --h           вьюпорт (по умолчанию 1920×1080).
//   --caption <текст>   подпись к фото в Telegram (HTML).
//   --no-tg             только сохранить на диск, не слать.
//
// Пример: npx tsx scripts/send-infographic.ts --url http://localhost:3000/series/guzliki-vs-from-paris --caption "Итог карты"
//
// PNG всегда кладётся в public/uploads/postgame (архив выгрузок, в .gitignore). Telegram — только
// если в .env есть TG_BOT_TOKEN / TG_CHAT_ID; иначе пайплайн отработает «в своё пространство» на диск.

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const url = flag("url");
  if (!url) {
    console.error("Нужен --url. Пример: --url http://localhost:3000/series/<slug>");
    process.exit(1);
  }
  const selector = flag("selector");
  const width = Number(flag("w") ?? 1920);
  const height = Number(flag("h") ?? 1080);
  const caption = flag("caption") ?? "";

  console.log(`Рендерю ${url} (${width}×${height}${selector ? `, элемент ${selector}` : ""})…`);
  const png = await renderUrlToPng(url, { width, height, selector, scale: 2 });

  const dir = join(process.cwd(), "public", "uploads", "postgame");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `infographic-${Date.now()}.png`);
  writeFileSync(file, png);
  console.log(`Сохранено: ${file} (${(png.length / 1024).toFixed(0)} КБ)`);

  if (has("no-tg")) {
    console.log("--no-tg: в Telegram не отправляю.");
    return;
  }
  if (!telegramConfigured()) {
    console.log("Нет TG_BOT_TOKEN / TG_CHAT_ID в .env — PNG только на диске. Впиши их, чтобы слать в бота.");
    return;
  }
  await sendPhoto(png, caption);
  console.log("Отправлено в Telegram ✅");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAIL:", e.message);
    process.exit(1);
  });
