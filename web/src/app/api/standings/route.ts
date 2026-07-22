import { NextResponse } from "next/server";
import { getStandings } from "@/lib/standings";

// JSON-фид таблицы — для встройки в Tilda и для визуальных шаблонов.
export async function GET() {
  return NextResponse.json(await getStandings());
}
