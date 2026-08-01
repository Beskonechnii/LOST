"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Ввод id матча. Форма ничего не грузит — она только собирает адрес отчёта:
// весь разбор живёт на /match/<id>, поэтому ссылкой на него можно поделиться.

/** Из ввода вынимаем число: пускай вставляют и ссылку на Dotabuff/OpenDota, и «Match ID: 123». */
function matchIdFrom(input: string): string | null {
  const digits = input.match(/\d{6,}/);
  return digits ? digits[0] : null;
}

export function MatchForm() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function open(src: "opendota" | "steam") {
    const id = matchIdFrom(input);
    if (!id) {
      setError("Не нашёл id матча — это длинное число, например 8907510684");
      return;
    }
    // opendota — путь по умолчанию, в адрес его не пишем: ссылка остаётся короткой.
    router.push(src === "steam" ? `/match/${id}?src=steam` : `/match/${id}`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && open("opendota")}
          placeholder="ID матча Dota 2, напр. 8907510684"
          inputMode="numeric"
          aria-label="ID матча Dota 2"
          className="w-full max-w-xs rounded-md border border-hairline-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-hairline-strong"
        />
        <button
          onClick={() => open("opendota")}
          disabled={!input.trim()}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas hover:bg-white disabled:opacity-50"
        >
          Разобрать
        </button>
        {/* Запасной источник: беднее данными, но живёт независимо от аварий OpenDota. */}
        <button
          onClick={() => open("steam")}
          disabled={!input.trim()}
          title="Первоисточник Valve: без графика золота, таймингов покупок, событий и ников"
          className="rounded-md border border-hairline-strong px-4 py-2 text-sm font-medium text-ink-muted hover:border-hairline-strong hover:text-white disabled:opacity-50"
        >
          Из Steam
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
    </div>
  );
}
