// Тема UI — цвета проекта, которыми управляет панель /admin/theme. Один источник правды: и editor
// строится из FIELDS, и корневой layout инжектит из этого же набора. Хранится в data/theme.json
// (коммитится, едет между устройствами как snapshot.json — чтения/записи в src/lib/theme-store.ts).
//
// Этот файл — ЧИСТЫЙ (без fs), чтобы его можно было тянуть и на клиент (editor). Всё, что про диск,
// живёт отдельно в theme-store.ts (server-only).

/** Ключи темы. Порядок здесь = порядок значения по умолчанию, но UI берёт порядок из FIELDS. */
export type ThemeKey =
  | "accent"
  | "accentBright"
  | "accentContrast"
  | "d2"
  | "d2Bright"
  | "d2Contrast"
  | "canvas"
  | "surface1"
  | "surface2"
  | "surface3"
  | "ink"
  | "inkMuted"
  | "inkSubtle"
  | "hairline"
  | "hairlineStrong"
  // Слой 1st-Pouf (claymorphism): вторая палитра, на ней студия, архив, TP, драфт, заглушки и бейджи.
  // Акцент pouf привязан к бренд-акценту выше (globals.css), поэтому отдельного поля у него нет.
  | "poufBg"
  | "poufSurface"
  | "poufInk"
  | "poufMuted"
  | "poufWarn"
  | "poufOrange"
  | "poufDown"
  | "poufUp"
  | "poufInfo";

export type Theme = Record<ThemeKey, string>;

/** Значения по умолчанию = ровно те литералы, что раньше стояли в globals.css. Fallback'и токенов
    совпадают с этими, поэтому пустой data/theme.json оставляет сайт как есть. */
export const DEFAULT_THEME: Theme = {
  accent: "#7c3aed",
  accentBright: "#a78bfa",
  accentContrast: "#ffffff",
  d2: "#14c6cb",
  d2Bright: "#5eead4",
  d2Contrast: "#000000",
  canvas: "#000000",
  surface1: "#15181e",
  surface2: "#1f232b",
  surface3: "#3b3d45",
  ink: "#ffffff",
  inkMuted: "#b2b6bd",
  inkSubtle: "#656a76",
  hairline: "rgba(178, 182, 189, 0.1)",
  hairlineStrong: "#3b3d45",
  // Дефолты pouf = значения ТЁМНОЙ темы pouf (сайт всегда тёмный): поверхности/текст оттуда,
  // акцентные пастельные — одинаковы в обеих темах. Совпадают с pouf.css, поэтому пустой файл
  // ничего не меняет.
  poufBg: "#12111a",
  poufSurface: "#211f2b",
  poufInk: "#f7f3ff",
  poufMuted: "#b8afcb",
  poufWarn: "#ffe58a",
  poufOrange: "#ffb38a",
  poufDown: "#ffb3d1",
  poufUp: "#a8f0d0",
  poufInfo: "#9ec8ff",
};

/** Группы для раскладки editor'а — порядок = порядок секций на странице. */
export type ThemeGroup = "Акцент" | "Поверхности" | "Текст" | "Границы" | "1st-Pouf";

/** Метаданные одного управляемого цвета: как подписать в UI и в какую сырую CSS-переменную писать. */
export type ThemeField = {
  key: ThemeKey;
  label: string;
  hint?: string;
  group: ThemeGroup;
  /** Сырая переменная, которую читает fallback токена в globals.css. */
  cssVar: string;
};

/** Полный список управляемых полей. Добавить цвет = строка сюда + ключ в ThemeKey/DEFAULT_THEME. */
export const FIELDS: ThemeField[] = [
  { key: "accent", label: "Бренд-акцент (D1)", hint: "Кнопки, ссылки, активные вкладки", group: "Акцент", cssVar: "--accent" },
  { key: "accentBright", label: "Акцент — светлый", hint: "Ховеры и подсветка", group: "Акцент", cssVar: "--accent-bright" },
  { key: "accentContrast", label: "Текст на акценте", hint: "Цвет надписи внутри залитой кнопки", group: "Акцент", cssVar: "--accent-contrast" },
  { key: "d2", label: "Акцент D2", hint: "Дивизион 2 перекрашивает акцент в него", group: "Акцент", cssVar: "--lost-d2" },
  { key: "d2Bright", label: "Акцент D2 — светлый", group: "Акцент", cssVar: "--lost-d2-bright" },
  { key: "d2Contrast", label: "Текст на акценте D2", group: "Акцент", cssVar: "--lost-d2-contrast" },
  { key: "canvas", label: "Канва", hint: "Самый нижний фон страницы", group: "Поверхности", cssVar: "--lost-canvas" },
  { key: "surface1", label: "Поверхность 1", hint: "Карточки над канвой", group: "Поверхности", cssVar: "--lost-surface-1" },
  { key: "surface2", label: "Поверхность 2", hint: "Приподнятые панели, поля ввода", group: "Поверхности", cssVar: "--lost-surface-2" },
  { key: "surface3", label: "Поверхность 3", group: "Поверхности", cssVar: "--lost-surface-3" },
  { key: "ink", label: "Текст основной", group: "Текст", cssVar: "--lost-ink" },
  { key: "inkMuted", label: "Текст приглушённый", group: "Текст", cssVar: "--lost-ink-muted" },
  { key: "inkSubtle", label: "Текст тусклый", group: "Текст", cssVar: "--lost-ink-subtle" },
  { key: "hairline", label: "Линия", hint: "Тонкая граница между блоками (можно rgba)", group: "Границы", cssVar: "--lost-hairline" },
  { key: "hairlineStrong", label: "Линия плотная", group: "Границы", cssVar: "--lost-hairline-strong" },
  // Слой pouf. cssVar = --lost-pouf-*; globals.css раздаёт их в pouf-переменные (и alias, и @theme-имя)
  // под скоупом .pouf-lost. Акцент pouf сюда не входит — он общий с брендом (--accent).
  { key: "poufBg", label: "Фон pouf", hint: "Нижний фон pouf-страниц (студия, архив)", group: "1st-Pouf", cssVar: "--lost-pouf-bg" },
  { key: "poufSurface", label: "Поверхность pouf", hint: "Карточки-подушки, поля", group: "1st-Pouf", cssVar: "--lost-pouf-surface" },
  { key: "poufInk", label: "Текст pouf", group: "1st-Pouf", cssVar: "--lost-pouf-ink" },
  { key: "poufMuted", label: "Текст pouf приглушённый", group: "1st-Pouf", cssVar: "--lost-pouf-muted" },
  { key: "poufWarn", label: "Предупреждение", hint: "Жёлтый: бейдж «в разработке», warn", group: "1st-Pouf", cssVar: "--lost-pouf-warn" },
  { key: "poufOrange", label: "Оранжевый", hint: "Акцент внимания в pouf", group: "1st-Pouf", cssVar: "--lost-pouf-orange" },
  { key: "poufDown", label: "Ошибка / поражение", hint: "Розово-красный: ошибки форм, down", group: "1st-Pouf", cssVar: "--lost-pouf-down" },
  { key: "poufUp", label: "Успех / победа", hint: "Мятный: up", group: "1st-Pouf", cssVar: "--lost-pouf-up" },
  { key: "poufInfo", label: "Инфо", hint: "Голубой: info", group: "1st-Pouf", cssVar: "--lost-pouf-info" },
];

/** Порядок групп на странице. */
export const GROUPS: ThemeGroup[] = ["Акцент", "Поверхности", "Текст", "Границы", "1st-Pouf"];

// Значение цвета попадает в <style> через dangerouslySetInnerHTML, поэтому его нужно чистить от
// всего, чем можно вырваться из `--x: VALUE;` (закрыть блок, вставить тег). Пропускаем только то, из
// чего складываются цвета: hex, rgb()/rgba()/hsl(), имена. Никаких ; { } < > " и т.п.
const SAFE_COLOR = /^[#0-9a-zA-Z.,%()/\s-]{1,64}$/;

/** Безопасное значение поля: своё, если проходит проверку, иначе дефолт. Защита и на записи, и на
    рендере — руками поправленный theme.json тоже не сможет ничего инжектнуть. */
export function safeValue(key: ThemeKey, raw: unknown): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  return SAFE_COLOR.test(v) ? v : DEFAULT_THEME[key];
}

/** Любой ввод → полная валидная тема (недостающее и грязное заменяется дефолтом). */
export function normalizeTheme(input: Partial<Record<ThemeKey, unknown>> | null | undefined): Theme {
  const out = {} as Theme;
  for (const { key } of FIELDS) out[key] = safeValue(key, input?.[key]);
  return out;
}

/** Тема → объект CSS-переменных для инлайн-`style`. Так её ставит и корневой layout на <html>
    (перекраска всего сайта), и editor на обёртку превью (живой черновик). Кроме полей дописываем
    --lost-d1/-bright из accent: D1 зеркалит бренд-акцент, одна настройка на оба. Значения чистые. */
export function themeToStyle(theme: Theme): React.CSSProperties {
  const t = normalizeTheme(theme);
  const style: Record<string, string> = {};
  for (const f of FIELDS) style[f.cssVar] = t[f.key];
  style["--lost-d1"] = t.accent;
  style["--lost-d1-bright"] = t.accentBright;
  return style as React.CSSProperties;
}
