import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 требует driver-adapter. Путь к БД — единый, из DATABASE_URL (.env);
// и CLI-миграции, и рантайм резолвят его относительно cwd (web/).
const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaLibSql({ url }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
