// Модель документа canvas-редактора. В отличие от TemplateDef (вёрстка захардкожена в React-компоненте),
// здесь раскладка — это данные: массив элементов с координатами в натуральных пикселях холста.
// Документ сериализуется в Design.doc (JSON, sqlite) и разворачивается обратно на клиенте.
//
// Инвариант координат тот же, что у шаблонов студии: элемент позиционируется абсолютно в натуральных
// пикселях (как top/left/width в vs-announce.tsx), а на экран весь холст влезает через transform: scale.

import { DEFAULT_FONT } from "./fonts";

export type ElementType = "text" | "image" | "rect" | "ellipse";

// Привязка элемента к данным лиги — то, что превращает свободный Design в шаблон. При «заполнении»
// серией привязанный text/image берёт значение из ростера и счёта (src/studio/editor/resolve),
// а элементы без привязки (фон, VS, декор) остаются ровно как нарисованы.
export type BindingSource = "teamA" | "teamB" | "playerA" | "playerB" | "series";
// Поля-строки идут в text.text, поля-картинки — в image.src (см. bindingFieldKind).
export type BindingField =
  | "name" // команда: название
  | "logo" // команда: лого
  | "wordmark" // команда: вордмарк
  | "nickname" // игрок: ник
  | "teamName" // игрок: его команда
  | "photo" // игрок: фото
  | "scoreA" // серия: счёт слева
  | "scoreB" // серия: счёт справа
  | "time" // серия: время начала
  | "format" // серия: формат bo
  | "stageLabel" // серия: картинка-ярлык стадии (PLAY-OFF / GROUP A / GROUP B)
  | "winnerBadge"; // серия: бейдж над победителем — ставится над левой, при победе правой зеркалится
export type Binding = { source: BindingSource; field: BindingField };

/** Общие поля любого элемента: бокс в натуральных пикселях, поворот, прозрачность. */
export type ElBase = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // градусы, вокруг центра бокса
  opacity: number; // 0..1
  hidden?: boolean; // скрыт в панели слоёв: не рисуется ни в превью, ни в PNG
  name?: string; // имя слоя, задаётся в панели слоёв (иначе показываем тип/текст)
  binding?: Binding; // привязка к данным серии; нет — элемент рисуется как задан
};

export type TextEl = ElBase & {
  type: "text";
  text: string;
  font: string; // семейство шрифта
  size: number; // px
  weight: number; // 100..900
  color: string; // hex/rgba
  align: "left" | "center" | "right";
  letterSpacing: number; // px
  lineHeight: number; // множитель
  uppercase: boolean;
  autoFit?: boolean; // ужимать кегль до одной строки по ширине бокса (имя команды в окошке рамки)
};

export type ImageEl = ElBase & {
  type: "image";
  src: string; // локальный путь (/uploads/library/..., /uploads/..., /assets/...) — иначе PNG-снимок сломается
  fit: "cover" | "contain";
  radius: number; // скругление рамки, px
};

export type ShapeEl = ElBase & {
  type: "rect" | "ellipse";
  fill: string;
  radius: number; // для rect, px
  stroke: string | null;
  strokeWidth: number;
};

export type Element = TextEl | ImageEl | ShapeEl;

/** Документ целиком. Порядок массива elements = порядок отрисовки (z-order): последний сверху. */
export type DesignDoc = {
  w: number;
  h: number;
  background: string; // цвет фона холста (под всеми элементами)
  elements: Element[];
};

// Пресеты формата — типовые размеры графики лиги. Первый = дефолт при создании.
export const FORMAT_PRESETS: { label: string; w: number; h: number }[] = [
  { label: "Пост 1920×1080", w: 1920, h: 1080 },
  { label: "Сторис 1080×1920", w: 1080, h: 1920 },
  { label: "Квадрат 1080×1080", w: 1080, h: 1080 },
  { label: "Обложка 1280×720", w: 1280, h: 720 },
];

export const DEFAULT_BACKGROUND = "#0b0413";

/** Пустой документ выбранного формата. */
export function emptyDoc(w = FORMAT_PRESETS[0].w, h = FORMAT_PRESETS[0].h): DesignDoc {
  return { w, h, background: DEFAULT_BACKGROUND, elements: [] };
}

// Простой уникальный id элемента: crypto.randomUUID есть и в браузере, и в node — без внешних зависимостей.
export const newId = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);

/** Заготовка элемента по центру холста — дальше оператор двигает вручную. */
export function makeElement(type: ElementType, doc: DesignDoc, extra?: Partial<Element>): Element {
  const base: ElBase = { id: newId(), x: 0, y: 0, w: 0, h: 0, rotation: 0, opacity: 1 };
  let el: Element;
  if (type === "text") {
    const w = Math.round(doc.w * 0.5);
    const h = 160;
    el = {
      ...base,
      w,
      h,
      type: "text",
      text: "Текст",
      font: DEFAULT_FONT,
      size: 96,
      weight: 800,
      color: "#ffffff",
      align: "center",
      letterSpacing: 0,
      lineHeight: 1.1,
      uppercase: false,
    };
  } else if (type === "image") {
    const side = Math.round(Math.min(doc.w, doc.h) * 0.3);
    el = { ...base, w: side, h: side, type: "image", src: "", fit: "contain", radius: 0 };
  } else {
    const w = Math.round(doc.w * 0.3);
    const h = Math.round(doc.h * 0.2);
    el = {
      ...base,
      w,
      h,
      type,
      fill: type === "rect" ? "#7c3aed" : "#a855f7",
      radius: type === "rect" ? 16 : 0,
      stroke: null,
      strokeWidth: 0,
    };
  }
  // центрируем по холсту
  el.x = Math.round((doc.w - el.w) / 2);
  el.y = Math.round((doc.h - el.h) / 2);
  return { ...el, ...(extra as object) } as Element;
}

/**
 * Адаптация под новый размер холста: позиции и размеры элементов масштабируются пропорционально,
 * кегль текста — по меньшему из коэффициентов (чтобы буквы не растягивались). Так смена формата не
 * рушит раскладку, а переносит её.
 */
export function scaleDoc(d: DesignDoc, w: number, h: number): DesignDoc {
  if (d.w === w && d.h === h) return { ...d, w, h };
  const rx = w / d.w;
  const ry = h / d.h;
  const rMin = Math.min(rx, ry);
  const elements = d.elements.map((e) => {
    const scaled = {
      ...e,
      x: Math.round(e.x * rx),
      y: Math.round(e.y * ry),
      w: Math.round(e.w * rx),
      h: Math.round(e.h * ry),
    } as Element;
    if (scaled.type === "text") scaled.size = Math.max(1, Math.round(scaled.size * rMin));
    return scaled;
  });
  return { ...d, w, h, elements };
}

/** Мягкая валидация документа из БД: гарантируем поля и типы, чтобы кривой JSON не ронял редактор. */
export function normalizeDoc(raw: unknown): DesignDoc {
  const r = (raw ?? {}) as Partial<DesignDoc>;
  const w = Number.isFinite(r.w) ? Number(r.w) : FORMAT_PRESETS[0].w;
  const h = Number.isFinite(r.h) ? Number(r.h) : FORMAT_PRESETS[0].h;
  const background = typeof r.background === "string" ? r.background : DEFAULT_BACKGROUND;
  const elements = Array.isArray(r.elements) ? (r.elements.filter(isElement) as Element[]) : [];
  return { w, h, background, elements };
}

function isElement(v: unknown): v is Element {
  if (!v || typeof v !== "object") return false;
  const t = (v as { type?: unknown }).type;
  return t === "text" || t === "image" || t === "rect" || t === "ellipse";
}
