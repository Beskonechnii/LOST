import type { NextConfig } from "next";

// Кто имеет право встроить нас в <iframe>. Публичная часть задумана как раздел основного сайта
// (см. ARCHITECTURE.md), а без этого заголовка встраивание браузер просто заблокирует.
// Список доменов — в FRAME_ANCESTORS через пробел, например:
//   FRAME_ANCESTORS="'self' https://leagueofspirits.ru https://*.leagueofspirits.ru"
// По умолчанию — только мы сами: чужие домены вписывает тот, кто их знает, а не дефолт.
const frameAncestors = process.env.FRAME_ANCESTORS?.trim() || "'self'";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Только frame-ancestors: полноценного CSP на приложение сейчас нет, а эта директива
          // работает сама по себе. X-Frame-Options намеренно не ставим — он умеет ровно один
          // домен и перебил бы список.
          { key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors};` },
        ],
      },
    ];
  },
};

export default nextConfig;
