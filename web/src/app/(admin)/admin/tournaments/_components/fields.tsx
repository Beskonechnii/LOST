import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TournamentStatus } from "@/lib/tournaments";

// Общие куски форм админки турниров: подпись + поле. Формы здесь простые (server actions, без
// клиентского состояния), поэтому вместо компонента-обёртки на каждый случай — одно поле на все.

export function Field({
  name,
  label,
  value,
  placeholder,
  type = "text",
  required = false,
  textarea = false,
  hint,
}: {
  name: string;
  label: string;
  value?: string | number | null;
  placeholder?: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  hint?: string;
}) {
  const common = {
    name,
    id: `f-${name}`,
    required,
    placeholder,
    defaultValue: value ?? undefined,
  };
  return (
    <label htmlFor={`f-${name}`} className="block">
      <span className="text-xs text-ink-muted">{label}</span>
      {textarea ? (
        <Textarea {...common} rows={4} className="mt-1" />
      ) : (
        <Input {...common} type={type} className="mt-1" />
      )}
      {hint && <span className="mt-1 block text-[11px] text-ink-subtle">{hint}</span>}
    </label>
  );
}

/** Цвет плашки статуса: «идёт» и «приём заявок» должны читаться с одного взгляда в списке. */
export const STATUS_TONE: Record<TournamentStatus, string> = {
  draft: "border-hairline bg-surface-2 text-ink-subtle",
  registration: "border-sky-900 bg-sky-950/40 text-sky-300",
  running: "border-emerald-900 bg-emerald-950/40 text-emerald-300",
  finished: "border-amber-900 bg-amber-950/40 text-amber-300",
};
