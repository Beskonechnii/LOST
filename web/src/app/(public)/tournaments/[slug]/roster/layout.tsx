import { SubNav } from "@/app/_components/site-nav";
import { SITE_MAX_W } from "@/app/_components/ui";
import { BackButton } from "@/app/_components/back-button";

// Ростер турнира: команды и игроки, заявленные именно в него. Живёт внутри /tournaments/<slug>,
// потому что состав — вещь сезонная: у команды свой состав в каждом турнире, а общий список «все
// команды за всю историю» витрине не нужен. Карточки (/roster/teams/<id>) при этом остались
// общими: команда и игрок переживают турнир, это сущности лиги, а не сезона.

export default async function RosterLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const base = `/tournaments/${slug}/roster`;
  const tabs = [
    { href: `${base}/teams`, label: "Команды", hint: "Составы, MMR, лого" },
    { href: `${base}/players`, label: "Игроки", hint: "Ники, роли, профили" },
  ];

  return (
    <>
      <SubNav items={tabs} />
      <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
        <BackButton fallback={`/tournaments/${slug}`} className="mb-4" />
        {children}
      </main>
    </>
  );
}
