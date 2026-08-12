// Только сервер: ручной OAuth-флоу Google для входа игроков.
//
// Зачем руками, а не NextAuth. Авторизация в проекте самодельная (см. lib/auth.ts): один пароль,
// подписанная кука, ноль внешних зависимостей. Вход игрока — та же история, только личность даёт
// Google. Тянуть ради одного провайдера NextAuth с его таблицами и адаптерами — против стиля.
//
// Ключи — в web/.env (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, шаблон в .env.example). Их заводят
// в Google Cloud Console; redirect_uri по умолчанию считается от адреса запроса, но при работе за
// прокси/туннелем перекрывается GOOGLE_REDIRECT_URI.

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Настроен ли вход через Google. Нет ключей — кнопка входа не показывается, а не падает. */
export const googleConfigured = () =>
  !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/** Куда Google вернёт с кодом. По умолчанию — от origin запроса; перекрывается для прокси/туннеля. */
export function redirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;
}

/** Адрес согласия Google: сюда уводим пользователя, `state` защищает от CSRF (сверяем на возврате). */
export function authUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account", // всегда даём выбрать аккаунт — вход не «залипает» на первом
  });
  return `${AUTH_ENDPOINT}?${params}`;
}

export type GoogleUser = { sub: string; email: string; name?: string; picture?: string };

/** Обмен кода на профиль: код → токены → распаковка id_token. Бросает, если Google ответил не так. */
export async function exchangeCode(origin: string, code: string): Promise<GoogleUser> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`google token endpoint: ${res.status}`);
  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) throw new Error("google: в ответе нет id_token");
  return decodeIdToken(json.id_token);
}

/**
 * Распаковка id_token без проверки подписи. Это допустимо: токен пришёл прямо из token-endpoint
 * Google по TLS в ответ на наш запрос с client_secret — канал доверенный, подделать нечем. Проверка
 * подписи (JWKS) понадобилась бы, если бы id_token приходил со стороны клиента, а не из этого fetch.
 */
function decodeIdToken(idToken: string): GoogleUser {
  const payloadB64 = idToken.split(".")[1];
  if (!payloadB64) throw new Error("google: битый id_token");
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  if (!payload.sub || !payload.email) throw new Error("google: в профиле нет sub/email");
  return { sub: String(payload.sub), email: String(payload.email), name: payload.name, picture: payload.picture };
}
