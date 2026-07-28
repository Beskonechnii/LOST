// Только сервер: «а вошёл ли оператор?» для серверных компонентов.
//
// Вынесено из lib/auth.ts намеренно: auth.ts импортирует `src/proxy.ts`, а тянуть туда
// `next/headers` нельзя — это API рендера страниц, не прокси-слоя. Здесь же оно уместно.
//
// Проверка нужна там, где страница публичная, но часть её содержимого — нет: витрины ростера
// показывают всем состав команд, а форму «добавить» — только вошедшему. Это удобство, а не
// защита: сама запись закрыта в needsAdmin() на уровне API, и без пароля не пройдёт всё равно.

import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyToken } from "./auth";

export async function isAdmin(): Promise<boolean> {
  return verifyToken((await cookies()).get(ADMIN_COOKIE)?.value);
}
