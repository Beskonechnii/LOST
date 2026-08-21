"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { parseUpload, saveDrafts, type ParseState, type SaveState } from "./actions";
import { roleLabel } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Два шага в одном экране: разобрать и показать → отметить команды и завести заявки. Состояние
// между шагами не храним ни в базе, ни в сессии — разобранный черновик едет обратно тем же JSON,
// который оператор видел в превью. Что показали, то и запишется.

const box = "rounded-lg border border-hairline bg-surface-1 p-4";
const errorBox = "rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300";

export function ImportForm({
  tournamentId,
  tournamentSlug,
  divisions,
}: {
  tournamentId: number;
  tournamentSlug: string;
  divisions: { id: number; name: string; short: string }[];
}) {
  const [parsed, parseAction, parsing] = useActionState<ParseState, FormData>(parseUpload, null);
  const [saved, saveAction, saving] = useActionState<SaveState, FormData>(saveDrafts, null);
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const router = useRouter();

  const teams = parsed?.teams ?? [];

  return (
    <div className="space-y-4">
      <form action={parseAction} className={`${box} space-y-3`}>
        <div>
          <label htmlFor="file" className="text-xs text-ink-muted">Файл (.xlsx, .csv, .tsv)</label>
          <Input id="file" name="file" type="file" accept=".xlsx,.csv,.tsv,text/csv" className="mt-1" />
        </div>
        <div>
          <label htmlFor="link" className="text-xs text-ink-muted">…или ссылка на гугл-таблицу</label>
          <Input id="link" name="link" placeholder="https://docs.google.com/spreadsheets/d/…" className="mt-1" />
          <span className="mt-1 block text-[11px] text-ink-subtle">
            Доступ к таблице должен быть открыт по ссылке — скачиваем её экспортом в xlsx.
          </span>
        </div>
        <div>
          <label htmlFor="pasted" className="text-xs text-ink-muted">…или вставьте таблицу текстом</label>
          <Textarea id="pasted" name="pasted" rows={4} className="mt-1" placeholder="Команда;Ник;Роль;MMR;Ссылка" />
        </div>
        <div>
          <label htmlFor="sheet" className="text-xs text-ink-muted">Только листы с названием, содержащим</label>
          <Input id="sheet" name="sheet" placeholder="команды" className="mt-1" />
        </div>
        <Button type="submit" size="sm" disabled={parsing}>
          {parsing ? "Разбираю…" : "Разобрать"}
        </Button>
        {parsed?.error && <p className={errorBox}>{parsed.error}</p>}
      </form>

      {teams.length > 0 && (
        <form action={saveAction} className={`${box} space-y-3`}>
          <input type="hidden" name="tournamentId" value={tournamentId} />
          <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
          <input type="hidden" name="teams" value={JSON.stringify(teams)} />

          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Разобрано команд: {teams.length}</h2>
            {parsed?.note && <span className="text-xs text-ink-subtle">{parsed.note}</span>}
          </div>

          <label className="block max-w-xs">
            <span className="text-xs text-ink-muted">Дивизион для этих заявок</span>
            <select
              name="divisionId"
              defaultValue={divisions[0]?.id ?? ""}
              className="mt-1 h-9 w-full rounded-md border border-hairline bg-surface-2 px-2 text-sm"
            >
              <option value="">— выбрать при апруве —</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>

          <ul className="space-y-2">
            {teams.map((t) => (
              <li key={t.slug} className="rounded-md border border-hairline bg-surface-2 p-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="pick"
                    value={t.slug}
                    defaultChecked
                    onChange={(e) => setSkip((s) => ({ ...s, [t.slug]: !e.target.checked }))}
                  />
                  <span className={`text-sm font-semibold ${skip[t.slug] ? "text-ink-subtle line-through" : ""}`}>
                    {t.name}
                  </span>
                  <span className="text-xs text-ink-subtle">
                    {t.tag ?? "без тега"} · /{t.slug} · {t.players.length} игрок(ов)
                  </span>
                </label>
                <ul className="mt-2 space-y-0.5 pl-6">
                  {t.players.map((p, i) => (
                    <li key={`${t.slug}-${i}`} className="text-xs text-ink-muted">
                      <span className="text-ink">{p.nickname}</span>
                      {p.realName && <span className="text-ink-subtle"> · {p.realName}</span>}
                      <span className="text-ink-subtle"> · {roleLabel(p.role) ?? "роль не разобрана"}</span>
                      {p.mmr && <span className="text-ink-subtle"> · {p.mmr} MMR</span>}
                      <span className={p.accountId ? "text-emerald-400" : "text-amber-400"}>
                        {p.accountId ? ` · id ${p.accountId}` : " · без account_id"}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Завожу…" : "Создать заявки"}
            </Button>
            {saved?.created ? (
              <span className="text-sm text-emerald-400">
                Заявок создано: {saved.created}.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => router.push(`/admin/tournaments/${tournamentSlug}/registrations`)}
                >
                  Открыть очередь
                </button>
              </span>
            ) : null}
          </div>
          {saved?.error && <p className={errorBox}>{saved.error}</p>}
        </form>
      )}
    </div>
  );
}
