// Шрифты редактора. Встроенные (системные) — здесь; пользовательские подхватываются автоматически
// из папки public/fonts (см. fonts-server.ts), дописывать ничего не нужно — просто положить файл.
// Этот модуль чистый (без fs), поэтому годится и на клиенте.

export type FontDef = {
  label: string; // подпись в списке «Шрифт»
  family: string; // CSS font-family (для файловых — имя, оно же объявляется в @font-face)
  src?: string; // путь к файлу от корня сайта; нет — системный шрифт
  weight?: string; // начертание файла, если оно одно
};

// Системные — всегда доступны, файла не требуют. Первый — значение по умолчанию для нового текста.
export const BUILTIN_FONTS: FontDef[] = [
  { label: "Системный", family: "var(--studio-font, system-ui)" },
  { label: "Sans-serif", family: "system-ui, Arial, sans-serif" },
  { label: "Serif", family: "Georgia, 'Times New Roman', serif" },
  { label: "Моноширинный", family: "'SF Mono', ui-monospace, monospace" },
];

export const DEFAULT_FONT = BUILTIN_FONTS[0].family;

/** CSS с @font-face для шрифтов, у которых указан файл. Один <style> на редактор. */
export function fontFaceCss(fonts: FontDef[]): string {
  return fonts
    .filter((f) => f.src)
    .map(
      (f) =>
        `@font-face{font-family:"${f.family}";src:url("${f.src}");${f.weight ? `font-weight:${f.weight};` : ""}font-display:swap;}`,
    )
    .join("\n");
}
