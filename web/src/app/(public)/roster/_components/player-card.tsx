import Link from "next/link";
import type { ReactNode } from "react";
import { countryCode } from "@/lib/profiles";
import { Chip } from "@/app/_components/ui";
import { PlayerAvatar } from "./avatar";

// Мини-карточка игрока — общий кирпич для витрины, тиммейтов и состава команды. Один вид на все
// места, чтобы страницы ростера читались как единый набор. Оформление — «полиш»: мягкая карточка,
// аватар на цвете команды, чип роли, MMR жирным; при наведении приподнимается.

export function PlayerMiniCard({
  id,
  nickname,
  photo,
  accent,
  role,
  mmr,
  isCaptain = false,
  country,
  size = 52,
  subtitle,
  trailing,
  flagged = false,
}: {
  id: number;
  nickname: string;
  photo: string | null;
  accent?: string | null;
  role?: string | null;
  mmr?: number | null;
  isCaptain?: boolean;
  country?: string | null;
  size?: number;
  /** Доп. строка под метой (например «ещё в …» или чек-лист пробелов анкеты). */
  subtitle?: ReactNode;
  /** Правый угол — номер позиции, значок и т.п. */
  trailing?: ReactNode;
  /** Тревожная обводка — операторская подсветка неполных данных. */
  flagged?: boolean;
}) {
  const code = countryCode(country);

  return (
    <Link
      href={`/roster/players/${id}`}
      className={`group flex items-center gap-3 rounded-xl border bg-surface-1 p-2.5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_10px_28px_-20px_rgba(0,0,0,0.9)] transition duration-200 hover:-translate-y-0.5 hover:bg-surface-2 ${
        flagged ? "border-amber-500/50 bg-amber-500/[0.06]" : "border-hairline hover:border-accent/50"
      }`}
    >
      <PlayerAvatar photo={photo} nickname={nickname} color={accent} size={size} className="rounded-xl" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-ink transition-colors group-hover:text-accent-bright">
            {nickname}
          </span>
          {isCaptain && <span className="shrink-0 text-[11px] font-bold text-accent-bright">C</span>}
          {code && <span className="shrink-0 text-[10px] font-medium text-ink-subtle">{code}</span>}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {role && <Chip>{role}</Chip>}
          {mmr ? <span className="text-xs font-semibold tabular-nums text-ink-muted">{mmr.toLocaleString("ru")} MMR</span> : null}
        </div>

        {subtitle}
      </div>

      {trailing}
    </Link>
  );
}
