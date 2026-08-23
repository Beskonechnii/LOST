// Локальный админ для тестов: аккаунт с ролью admin и всеми правами, вход по email + паролю.
//
// Зачем скриптом, а не через UI: форма регистрации требует пароль от 8 символов и заводит аккаунт
// игроком в статусе `draft` — для тестового админа это лишние шаги. Логин длину пароля не проверяет
// (см. loginWithPassword), поэтому короткий пароль здесь работает.
//
//   npx tsx scripts/dev-admin.ts                    # admin@admin.com / admin
//   npx tsx scripts/dev-admin.ts --email a@b.c --password secret
//   npx tsx scripts/dev-admin.ts --remove           # снести тестового админа
//
// ВАЖНО: это дырка ровно на время локальных тестов. Аккаунт лежит в `prisma/dev.db`, а она
// коммитится (см. §8 CLAUDE.md) — перед выкладкой наружу снести его `--remove`.
// Владельцем такой аккаунт не станет: владелец определяется по OWNER_EMAIL (account.ts).

import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import { PERMISSIONS } from "../src/lib/permissions";

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

async function main() {
  const email = arg("email", "admin@admin.com").trim().toLowerCase();

  if (process.argv.includes("--remove")) {
    const { count } = await prisma.userAccount.deleteMany({ where: { email } });
    console.log(count ? `Удалён аккаунт ${email}` : `Аккаунта ${email} нет`);
    return;
  }

  const password = arg("password", "admin");
  // Все права разом: тестовому админу нужно видеть каждый раздел, иначе тест упирается в плашку
  // «попросите владельца» вместо самой страницы.
  const permissions = PERMISSIONS.map((p) => p.key).join(",");
  const data = {
    role: "admin",
    status: "active",
    permissions,
    passwordHash: hashPassword(password),
    name: "Админ (тест)",
  };

  const account = await prisma.userAccount.upsert({
    where: { email },
    create: { email, ...data },
    update: data,
  });

  console.log(`Готово: ${email} / ${password}`);
  console.log(`  id ${account.id}, роль ${account.role}, статус ${account.status}`);
  console.log(`  прав: ${PERMISSIONS.length} (${permissions})`);
}

main().finally(() => prisma.$disconnect());
