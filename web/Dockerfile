# Прод-образ приложения LOST.
#
# Next 16 — это долгоживущий Node-процесс, а не папка со статикой: он рендерит страницы,
# ходит в OpenDota, отдаёт /api/* и читает SQLite. Поэтому нужен контейнер или VPS,
# на PHP-хостинг (InfinityFree и подобные) это не ставится в принципе.
#
# База Debian, а не Alpine: у libsql нативные биндинги, собранные под glibc,
# на musl они падают уже при старте. Экономия на размере образа тут того не стоит.

FROM node:24-bookworm-slim AS build
WORKDIR /app

# openssl нужен движкам Prisma; ca-certificates — исходящим https (OpenDota, Steam, OpenAI)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# schema копируем до npm ci: postinstall дёргает `prisma generate`, без схемы он падает
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

COPY . .
# Сборке живая база не нужна — статические страницы в БД не ходят, значение чисто формальное
ENV DATABASE_URL="file:./data/dev.db"
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# База лежит в /app/data — это отдельный том. В /app/prisma её держать нельзя:
# том затенил бы схему и миграции, которые нужны самому образу.
ENV DATABASE_URL="file:./data/dev.db"
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# node_modules переносим целиком, вместе с dev-зависимостями: `prisma migrate deploy`
# на старте контейнера — это CLI Prisma, а он живёт в devDependencies.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
# `next start` читает конфиг в рантайме: без этого файла отвалятся заголовки (frame-ancestors).
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/generated ./src/generated

# Эталон закоммиченных ассетов: том с uploads монтируется поверх public/uploads и затеняет
# лого команд из репозитория. На старте докладываем недостающее отсюда (см. entrypoint).
RUN cp -r public/uploads ./.seed-uploads

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
