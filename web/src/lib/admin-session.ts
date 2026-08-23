// Только сервер: «а есть ли у вошедшего права администратора?» для серверных компонентов.
//
// Нужна там, где страница публичная, но часть содержимого — нет: витрины ростера показывают всем
// состав команд, а формы «добавить» и операторскую диагностику — только админам. Читаем роль прямо
// из подписанной сессионной куки (owner/admin), без похода в БД — этого достаточно, чтобы решить,
// показывать ли операторский кусок. Сама запись всё равно закрыта в needsAdmin() на уровне API.

import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionIsAdmin } from "./player-auth";

export async function isAdmin(): Promise<boolean> {
  return sessionIsAdmin((await cookies()).get(SESSION_COOKIE)?.value);
}
