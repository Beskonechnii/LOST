// Только сервер: отправка писем. Через Resend по HTTP (fetch, как google-oauth/openai — без npm-
// зависимости), а когда ключа нет — печать в консоль, чтобы на локалке всё работало без настройки.
//
// Ключи в web/.env: RESEND_API_KEY (без него письма только логируются), MAIL_FROM (адрес отправителя,
// напр. "LOST <noreply@leagueofspirits.ru>"). Базовый адрес ссылок — APP_URL (иначе берём origin
// запроса, см. вызовы в account.ts). Смена провайдера на SMTP затрагивает только этот файл.

import "server-only";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Настроена ли реальная отправка. Нет ключа — письма уходят в консоль, а не теряются молча. */
export const mailerConfigured = () => !!process.env.RESEND_API_KEY;

const from = () => process.env.MAIL_FROM || "LOST <onboarding@resend.dev>";

type Mail = { to: string; subject: string; html: string; text: string };

/** Низкоуровневая отправка. Настроен Resend — шлём; нет — печатаем в консоль (dev). Не бросает наружу. */
export async function sendMail({ to, subject, html, text }: Mail): Promise<void> {
  if (!mailerConfigured()) {
    // Локалка без почты: письмо (и ссылку внутри) видно в логе сервера — так можно пройти флоу.
    console.log(`\n[mail:dev] → ${to}\n  ${subject}\n  ${text}\n`);
    return;
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: from(), to, subject, html, text }),
    });
    if (!res.ok) console.error(`[mail] resend ${res.status}: ${await res.text()}`);
  } catch (e) {
    // Письмо — не повод ронять регистрацию: логируем и продолжаем (ссылку всё равно видно в консоли dev).
    console.error("[mail] отправка не удалась:", e);
  }
}

// Общая обёртка простого письма-кнопки: заголовок, абзац, крупная ссылка. Незамысловато, но узнаваемо.
function template(heading: string, intro: string, link: string, cta: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:20px;margin:0 0 12px">${heading}</h1>
  <p style="margin:0 0 20px;color:#444">${intro}</p>
  <p style="margin:0 0 20px"><a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${cta}</a></p>
  <p style="margin:0;color:#888;font-size:13px">Если кнопка не работает, откройте ссылку:<br>${link}</p>
</div>`;
}

/** Письмо с подтверждением почты при регистрации. */
export function sendVerifyEmail(to: string, link: string): Promise<void> {
  return sendMail({
    to,
    subject: "Подтверждение почты — League of Spirits",
    html: template("Подтвердите почту", "Вы регистрируетесь в League of Spirits. Нажмите кнопку, чтобы активировать аккаунт.", link, "Подтвердить почту"),
    text: `Подтвердите почту в League of Spirits: ${link}`,
  });
}

/** Письмо со ссылкой сброса пароля. */
export function sendResetEmail(to: string, link: string): Promise<void> {
  return sendMail({
    to,
    subject: "Восстановление пароля — League of Spirits",
    html: template("Сброс пароля", "Кто-то запросил сброс пароля для этого адреса. Если это вы — задайте новый пароль по кнопке (ссылка живёт час). Если нет — просто проигнорируйте письмо.", link, "Задать новый пароль"),
    text: `Сброс пароля в League of Spirits (ссылка живёт час): ${link}`,
  });
}
