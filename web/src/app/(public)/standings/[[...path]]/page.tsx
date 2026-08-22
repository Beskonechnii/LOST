import { notFound, redirect } from "next/navigation";
import { currentTournament } from "@/lib/tournaments";

// Старые адреса сезона. Разделы дивизиона переехали под турнир (/tournaments/<турнир>/<дивизион>),
// но ссылки вида /standings/d1/groups раздавались в чат и стоят в закладках — поэтому здесь
// редирект на тот же раздел текущего турнира, а не 404.
export default async function StandingsRedirect({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const current = await currentTournament();
  if (!current) notFound(); // турниров в базе нет — вести некуда
  redirect([`/tournaments/${current.slug}`, ...path].join("/"));
}
