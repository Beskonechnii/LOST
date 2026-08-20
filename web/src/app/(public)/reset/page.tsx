import { ResetForm } from "./reset-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Сброс пароля" };

// Восстановление пароля. Без токена — форма запроса ссылки; с токеном (?token=…) из письма — форма
// нового пароля. Публичная страница (в needsAdmin не значится): к ней приходят как раз без входа.

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <main className="flex-1 px-4 py-10 md:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-fuchsia-600 text-xl font-black text-white shadow-lg shadow-accent/20">
            L
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Восстановление пароля</h1>
          <p className="mt-1 text-sm text-ink-muted">League of Spirits</p>
        </div>

        <div className="rounded-2xl border border-hairline bg-surface-1/60 p-5 shadow-xl shadow-black/20 backdrop-blur">
          <ResetForm token={token ?? null} />
        </div>
      </div>
    </main>
  );
}
