// Сборка публичной таблицы в статику: БД → одна самодостаточная HTML-страница + JSON.
//
// Запуск (из web/):  npx tsx scripts/build-standings-site.ts
//   --out <dir>   куда сложить (по умолчанию dist/standings)
//   --light       светлая тема (если лендинг светлый)
//
// Зачем это есть. Само приложение — живой процесс Node.js, и на PHP-хостинг (InfinityFree
// и подобные) не ставится в принципе. Но публично от лиги нужна только таблица, а она
// прекрасно живёт статикой: раз в тур пересобрали, залили файлы — готово. Это и был
// исходный план из ARCHITECTURE.md: заменить блок с Google Sheets на лендинге.
//
// Страница намеренно без единого внешнего запроса — ни шрифтов, ни скриптов, ни картинок.
// Так она одинаково работает и по прямой ссылке, и внутри iframe на Tilda, и с диска.

import fs from "node:fs/promises";
import path from "node:path";
import { getStandings, type StandingGroup } from "@/lib/standings";
import { QUALIFICATION, qualificationOf, type Qualification } from "@/lib/qualification";
import { DIVISIONS, divisionBySlug } from "@/lib/divisions";

const args = process.argv.slice(2);
const outDir = path.resolve(process.cwd(), argValue("--out") ?? "dist/standings");
const light = args.includes("--light");
// Какой дивизион собирать: --div d1|d2 (по умолчанию первый).
const division = (argValue("--div") && divisionBySlug(argValue("--div")!)) || DIVISIONS[0];

function argValue(flag: string): string | null {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
}

/** Имена команд приходят из БД и попадают в разметку — экранируем, иначе кавычка ломает вёрстку. */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Цвета зон дублируем сюда числом: в qualification.ts они заданы классами Tailwind,
// а здесь Tailwind нет — только инлайновый CSS. Значения те же, что даёт палитра.
const ZONE_COLOR: Record<Qualification, string> = {
  upper: "#34d399",
  lower: "#fbbf24",
  out: "#fb7185",
};

function styles(): string {
  // Две темы: тёмная под брендбук, светлая — если лендинг светлый (--light).
  const c = light
    ? { bg: "transparent", card: "#ffffff", line: "#e5e5e5", text: "#171717", dim: "#737373", head: "#f5f5f5" }
    : { bg: "transparent", card: "#141118", line: "#2a2630", text: "#f5f5f5", dim: "#8b8b8b", head: "#1b1722" };

  return `
    *{box-sizing:border-box}
    body{margin:0;padding:16px;background:${c.bg};color:${c.text};
         font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
    .wrap{max-width:1100px;margin:0 auto}
    h1{margin:0 0 4px;font-size:22px;letter-spacing:-.02em}
    .sub{margin:0 0 16px;color:${c.dim};font-size:12px}
    .legend{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:16px;color:${c.dim};font-size:12px}
    .legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}
    .groups{display:grid;gap:20px}
    @media(min-width:900px){.groups{grid-template-columns:1fr 1fr}}
    .card{border:1px solid ${c.line};border-radius:10px;overflow:hidden;background:${c.card}}
    .cap{padding:9px 14px;background:${c.head};border-bottom:1px solid ${c.line};
         font-weight:700;font-size:13px;letter-spacing:.04em}
    .cap span{font-weight:400;color:${c.dim};margin-left:8px;font-size:12px}
    table{width:100%;border-collapse:collapse}
    th{padding:8px 6px;text-align:center;font-size:11px;font-weight:500;color:${c.dim};
       border-bottom:1px solid ${c.line};text-transform:uppercase;letter-spacing:.05em}
    th.l,td.l{text-align:left}
    td{padding:9px 6px;text-align:center;border-bottom:1px solid ${c.line}}
    tr:last-child td{border-bottom:0}
    td.pl{padding-left:12px;white-space:nowrap}
    td.pl i{display:inline-block;width:3px;height:15px;border-radius:2px;margin-right:8px;vertical-align:-3px}
    .tag{color:${c.dim};font-size:11px;font-weight:600}
    .team{font-weight:600}
    .pts{font-weight:800;padding-right:12px}
    .dim{color:${c.dim}}
    footer{margin-top:16px;color:${c.dim};font-size:11px;text-align:right}
  `.trim();
}

function tableFor(g: StandingGroup): string {
  const rows = g.rows
    .map((r, i) => {
      const place = r.place ?? i + 1;
      const zone = qualificationOf(place, g.rows.length);
      const color = ZONE_COLOR[zone];
      // Команда — просто текст, без ссылки: в статике страниц команд нет,
      // а битая ссылка хуже её отсутствия.
      return `<tr>
        <td class="l pl"><i style="background:${color}" title="${esc(QUALIFICATION[zone].label)}"></i>${place}</td>
        <td class="l tag">${esc(r.tag)}</td>
        <td class="l team" style="color:${color}">${esc(r.name)}</td>
        <td>${r.played}</td>
        <td>${r.wins}</td>
        <td class="dim">${r.losses}</td>
        <td class="pts">${r.points}</td>
      </tr>`;
    })
    .join("\n");

  return `<section class="card">
    <div class="cap">Группа ${esc(g.group)}<span>${g.rows.length} команд</span></div>
    <table>
      <thead><tr>
        <th class="l" style="padding-left:12px">#</th><th class="l">Тег</th><th class="l">Команда</th>
        <th>И</th><th>В</th><th>П</th><th style="padding-right:12px">Очки</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function page(groups: StandingGroup[], updated: string): string {
  const legend = (["upper", "lower", "out"] as const)
    .map((k) => `<span><i style="background:${ZONE_COLOR[k]}"></i>${QUALIFICATION[k].label}</span>`)
    .join("");

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LOST — таблица лиги</title>
<style>${styles()}</style>
</head>
<body>
<div class="wrap">
  <h1>Таблица лиги</h1>
  <p class="sub">League of Spirit · Division 1</p>
  <div class="legend">${legend}</div>
  <div class="groups">
${groups.map(tableFor).join("\n")}
  </div>
  <footer>Обновлено ${esc(updated)}</footer>
</div>
<script>
// Встройка в Tilda: iframe не умеет подстраивать высоту под содержимое сам,
// поэтому сообщаем её родителю. Без этого таблица обрежется или получит лишний скролл.
(function () {
  function send() {
    var h = document.documentElement.scrollHeight;
    try { parent.postMessage({ lostStandingsHeight: h }, "*"); } catch (e) {}
  }
  window.addEventListener("load", send);
  window.addEventListener("resize", send);
})();
</script>
</body>
</html>`;
}

async function main() {
  const groups = await getStandings(division.name);
  if (groups.length === 0) {
    console.error(`В базе нет команд дивизиона ${division.name} — сначала залей ростер (см. CLAUDE.md §7).`);
    process.exit(1);
  }

  const updated = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "index.html"), page(groups, updated), "utf8");
  // JSON рядом — на случай, если таблицу захочется рисовать своей вёрсткой на лендинге
  // (второй вариант встройки из ARCHITECTURE.md: fetch вместо iframe).
  await fs.writeFile(
    path.join(outDir, "standings.json"),
    JSON.stringify({ updated: new Date().toISOString(), groups }, null, 2),
    "utf8",
  );

  const total = groups.reduce((s, g) => s + g.rows.length, 0);
  console.log(`Готово: ${groups.length} групп, ${total} команд → ${outDir}`);
  console.log("Залей содержимое папки в htdocs хостинга (или в подпапку /standings).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
