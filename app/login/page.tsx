import { PawPrint } from "lucide-react";
import { redirect } from "next/navigation";
import { createUserSupabaseClient } from "@/lib/supabase/server";

const EMAIL_DOMAIN = "@mirandaspetboutique.com";

async function signIn(formData: FormData) {
  "use server";

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!/^[a-z0-9._-]+$/.test(username) || !password) {
    redirect("/login?error=Ingresa%20un%20usuario%20y%20una%20contrase%C3%B1a%20v%C3%A1lidos.");
  }

  const supabase = await createUserSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: `${username}${EMAIL_DOMAIN}`,
    password
  });

  if (error) {
    redirect("/login?error=Usuario%20o%20contrase%C3%B1a%20incorrectos.");
  }

  redirect("/");
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-cloud px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 border-t-4 border-t-brand-gold bg-white p-8 shadow-panel">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gold text-brand-black">
            <PawPrint className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-semibold text-ink">Miranda&apos;s Pet Boutique</p>
            <p className="text-sm text-slate-500">Operación de grooming</p>
          </div>
        </div>

        <div className="mt-8">
          <h1 className="text-2xl font-semibold text-ink">Inicia sesión</h1>
          <p className="mt-2 text-sm text-slate-500">
            Usa tu usuario del equipo para entrar al panel.
          </p>
        </div>

        {error ? (
          <p className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <form action={signIn} className="mt-6 space-y-5">
          <div>
            <label className="text-sm font-medium text-ink" htmlFor="username">
              Usuario
            </label>
            <div className="mt-1 flex rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-jade">
              <input
                autoComplete="username"
                className="min-w-0 flex-1 rounded-lg border-0 px-3 py-2.5 text-ink outline-none"
                id="username"
                name="username"
                placeholder="victorfarfan"
                required
                type="text"
              />
              <span className="flex items-center pr-3 text-sm text-slate-400" aria-hidden="true">
                {EMAIL_DOMAIN}
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-ink" htmlFor="password">
              Contraseña
            </label>
            <input
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-jade"
              id="password"
              name="password"
              required
              type="password"
            />
          </div>

          <button
            className="w-full rounded-lg bg-brand-black px-4 py-2.5 font-semibold text-white transition hover:bg-brand-black focus:outline-none focus:ring-2 focus:ring-brand-black focus:ring-offset-2"
            type="submit"
          >
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
