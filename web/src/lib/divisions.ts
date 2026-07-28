// Дивизионы лиги — один справочник для навигации, маршрутов /standings/<slug> и разделения ростера.
// slug живёт в URL (d1/d2); name — как дивизион записан в Team.group и в *.division ("Division 1"),
// поэтому одно значение связывает адрес, таблицу и групповую стадию.

export type Division = { slug: string; name: string; label: string; short: string };

/** Порядок массива = порядок вкладок в навигации и блоков в ростере. */
export const DIVISIONS: Division[] = [
  { slug: "d1", name: "Division 1", label: "LOST D1", short: "D1" },
  { slug: "d2", name: "Division 2", label: "LOST D2", short: "D2" },
];

/** Дивизион по слагу из URL — null, если такого нет (роут отдаёт notFound). */
export const divisionBySlug = (slug: string): Division | null =>
  DIVISIONS.find((d) => d.slug === slug) ?? null;

/** Слаг по имени дивизиона (из Team.group). Неизвестное имя → первый дивизион. */
export const divisionSlug = (name: string | null | undefined): string =>
  DIVISIONS.find((d) => d.name === name)?.slug ?? DIVISIONS[0].slug;
