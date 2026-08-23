// Дивизионы лиги — чистый справочник: тип и хелперы поверх списка. Раньше здесь лежал сам список
// константой, теперь дивизионы живут в БД (модель `Division` турнира), а список приходит из
// src/lib/tournaments.ts — серверного модуля, который и знает, какой турнир текущий.
//
// Почему модуль всё-таки остался: DIVISIONS читали и клиентские компоненты (вкладки ростера,
// карточки команд), а тянуть в них БД нельзя. Список им передаётся пропом, а разбор («какой
// дивизион по слагу из URL») остаётся общим для сервера и клиента — как roles.ts и stages.ts.

export type Division = {
  /** id строки в БД; нужен формам админки, витринам — нет. */
  id: number;
  /** живёт в URL: /tournaments/<турнир>/d1 */
  slug: string;
  /** «Division 1» — то же значение, что в Team.group и Series.division */
  name: string;
  /** «LOST D1» — подпись раздела */
  label: string;
  /** «D1» — короткая подпись вкладки */
  short: string;
  /** Вылетают ли последние из группы (см. qualification.ts). */
  relegation: boolean;
};

/** Дивизион по слагу из URL — null, если такого нет (роут отдаёт notFound). */
export const divisionBySlug = (list: Division[], slug: string): Division | null =>
  list.find((d) => d.slug === slug) ?? null;

/** Слаг по имени дивизиона (из Team.group). Неизвестное имя → первый дивизион списка. */
export const divisionSlug = (list: Division[], name: string | null | undefined): string =>
  list.find((d) => d.name === name)?.slug ?? list[0]?.slug ?? "d1";

/** Имя дивизиона по слагу; null — слаг чужой. Обратное к `divisionSlug`. */
export const divisionName = (list: Division[], slug: string | null | undefined): string | null =>
  list.find((d) => d.slug === slug)?.name ?? null;
