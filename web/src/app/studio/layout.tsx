// Студия — только генерация графики. Профили команд и игроков живут в разделе «Ростер»,
// студия берёт их оттуда как справочник (src/lib/studio-refs.ts).

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">{children}</main>;
}
