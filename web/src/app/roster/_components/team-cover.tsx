import { teamTag } from "@/lib/profiles";

// Обложка команды. Настоящего фото нет ни у кого, а пустая тёмная полоса над карточкой выглядит
// как недогрузившаяся картинка. Поэтому фолбэк не «пустота с градиентом», а собранный фон:
// два цветных пятна, диагональная штриховка, лого-подсветка и огромный тег на фоне.
// Как только у команды появится Team.photo — обложкой станет он, вёрстку менять не придётся.

export function TeamCover({
  team,
  accent,
  className = "",
}: {
  team: { name: string; tag?: string | null; logo: string | null; wordmark?: string | null; photo?: string | null };
  accent: string;
  className?: string;
}) {
  return (
    <div className={`relative h-32 overflow-hidden sm:h-40 ${className}`}>
      {team.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.photo} alt="" className="h-full w-full object-cover" />
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                `radial-gradient(120% 150% at 8% -20%, ${accent}66 0%, transparent 60%),` +
                `radial-gradient(90% 130% at 88% 0%, ${accent}33 0%, transparent 55%),` +
                `#0a0a0a`,
            }}
          />
          {/* штриховка ловит свет по диагонали — без неё пятна читаются как градиент «ни о чём» */}
          <div
            className="absolute inset-0 opacity-[0.13]"
            style={{ backgroundImage: `repeating-linear-gradient(115deg, ${accent} 0 2px, transparent 2px 16px)` }}
          />
          {/* тег команды во всю высоту: у каждой команды силуэт обложки получается свой */}
          <span className="pointer-events-none absolute -bottom-4 right-3 select-none text-[5.5rem] font-black leading-none tracking-tighter text-white/[0.055] sm:text-[7rem]">
            {teamTag(team)}
          </span>
          {team.logo && (
            // лого-подсветка: размытое пятно нужного цвета там, где на карточке стоит сама эмблема
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={team.logo}
              alt=""
              className="pointer-events-none absolute -left-6 -top-10 h-52 w-52 object-contain opacity-25 blur-2xl"
            />
          )}
        </>
      )}

      {/* нижняя растушёвка в фон страницы — чтобы обложка не обрывалась ровной линией */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, transparent 35%, rgba(10,10,10,0.65) 75%, #0a0a0a 100%)` }}
      />

      {team.wordmark && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.wordmark}
          alt={team.name}
          className="absolute bottom-3 right-4 max-h-12 max-w-[45%] object-contain object-right opacity-90"
        />
      )}
    </div>
  );
}
