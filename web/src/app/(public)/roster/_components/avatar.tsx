import { teamTag } from "@/lib/profiles";

// Аватарка игрока. Фото есть далеко не у всех, поэтому заглушка — не серый квадрат,
// а инициалы ника на градиенте в цвет команды: страница выглядит целой и без единого кадра.

const ACCENT = "#a855f7"; // фирменный фиолетовый — цвет по умолчанию, если у команды свой не задан

/** Одна-две первых буквы ника. «B U R I Z A» → «BU», «300$» → «30», кириллица как есть. */
function initials(nickname: string): string {
  const letters = [...nickname].filter((ch) => /[\p{L}\p{N}]/u.test(ch));
  return letters.slice(0, 2).join("").toUpperCase() || "?";
}

export function PlayerAvatar({
  photo,
  nickname,
  color,
  size = 160,
  className = "",
}: {
  photo: string | null;
  nickname: string;
  color?: string | null;
  size?: number;
  className?: string;
}) {
  const accent = color?.trim() || ACCENT;

  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 ${className}`}
      style={{
        width: size,
        height: size,
        // прозрачность цвета команды в hex-суффиксе: так градиент работает с любым значением из поля
        background: photo ? "#0a0a0a" : `linear-gradient(140deg, ${accent}66, ${accent}14 60%, #0a0a0a)`,
      }}
    >
      {photo ? (
        // локальный файл из public/uploads — оптимизация next/image здесь не нужна
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={nickname} className="h-full w-full object-cover" />
      ) : (
        <span
          className="font-bold tracking-tight text-white/85"
          style={{ fontSize: Math.round(size * 0.34) }}
        >
          {initials(nickname)}
        </span>
      )}
    </div>
  );
}

/** Лого команды с текстовым фолбэком на тег — тем же, что печатается в таблицах. */
export function TeamLogo({
  team,
  size = 40,
  className = "",
}: {
  team: { name: string; tag?: string | null; logo: string | null };
  size?: number;
  className?: string;
}) {
  return (
    <div className={`grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }}>
      {team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo} alt={team.name} className="h-full w-full object-contain" />
      ) : (
        <span className="text-xs font-semibold text-neutral-500">{teamTag(team)}</span>
      )}
    </div>
  );
}
