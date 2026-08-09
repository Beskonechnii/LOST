// Только сервер / скрипт: рендер страницы в PNG через headless-браузер (кирпич C роадмапа).
// Нужен там, где клиентский modern-screenshot не годится — автоматическая выгрузка без окна
// оператора (инфографика матча в ТГ, серверные OG-картинки).
//
// Playwright — devDependency и тянется лениво (import внутри функции): в клиентский бандл и в
// обычный рантайм приложения он не попадает, зовётся только из скриптов/серверных утилит.
// Браузер ставится один раз: `npx playwright install chromium`.

export type RenderOptions = {
  width?: number;
  height?: number;
  /** Снять не всю страницу, а один элемент по CSS-селектору (например «голый» холст рендера). */
  selector?: string;
  /** Множитель плотности пикселей — для чётких картинок под ретину/шеринг. */
  scale?: number;
  /** Сколько ждать сетевого затишья, мс. */
  timeoutMs?: number;
};

/** Отрисовать URL в PNG и вернуть Buffer. Бросает понятную ошибку, если браузер не установлен. */
export async function renderUrlToPng(url: string, opts: RenderOptions = {}): Promise<Buffer> {
  const { width = 1920, height = 1080, selector, scale = 2, timeoutMs = 20000 } = opts;

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("Playwright не установлен. Поставь: npm i -D playwright && npx playwright install chromium");
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
    await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });

    if (selector) {
      const el = await page.waitForSelector(selector, { timeout: timeoutMs });
      if (!el) throw new Error(`Элемент «${selector}» не найден на ${url}`);
      const buf = await el.screenshot({ type: "png" });
      return buf as Buffer;
    }
    const buf = await page.screenshot({ type: "png", fullPage: false });
    return buf as Buffer;
  } finally {
    await browser.close();
  }
}
