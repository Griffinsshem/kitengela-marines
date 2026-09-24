"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";

const FIELD_CLASSES =
  "mt-2 w-full rounded-control border border-chalk/30 bg-chalk/5 px-3 py-2.5 text-chalk";

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signIn(email, password);
    if (result.ok) {
      router.replace("/admin");
      return;
    }

    // Whatever the API said, and it says the same thing for an unknown email
    // as for a wrong password.
    setError(result.error);
    setBusy(false);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-pitch px-5 py-12 text-chalk">
      <div className="w-full max-w-sm">
        <div aria-hidden="true" className="flex h-1.5 w-28 overflow-hidden">
          <span className="flex-1 bg-men-green" />
          <span className="flex-1 bg-men-yellow" />
          <span className="flex-1 bg-men-gold" />
        </div>
        <h1 className="mt-6 font-display text-headline font-black uppercase leading-none">
          Club administration
        </h1>
        <p className="mt-3 text-meta text-chalk/70">
          Sign in to manage news, squads, fixtures and media.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="block text-meta font-semibold">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={FIELD_CLASSES}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-meta font-semibold">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={FIELD_CLASSES}
            />
          </div>

          {error ? (
            // Announced by a screen reader when it appears, not just shown.
            <p role="alert" className="border border-chalk/30 px-3 py-2 text-meta">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-control bg-highlight px-4 py-3 font-semibold text-on-highlight disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
