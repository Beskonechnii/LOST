import { NextResponse } from "next/server";
import { getStandings } from "@/lib/standings";
import { DIVISIONS, divisionBySlug } from "@/lib/divisions";

// JSON-фид таблицы — для встройки в Tilda и для визуальных шаблонов.
// Дивизион выбирается параметром ?div=d1|d2 (по умолчанию первый), чтобы фид для D2 брался тем же роутом.
export async function GET(req: Request) {
  const div = new URL(req.url).searchParams.get("div");
  const division = (div && divisionBySlug(div)) || DIVISIONS[0];
  return NextResponse.json(await getStandings(division.name));
}
