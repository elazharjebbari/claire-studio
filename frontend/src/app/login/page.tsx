"use client";

/** Authentification JWT (CONTRACT §3 /auth/login). SSO-ready (placeholder). */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { login } from "@/lib/api/endpoints";
import { Button, Field, Panel } from "@/components/ui/primitives";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("alice");
  const [password, setPassword] = useState("claire-demo");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
      const next = searchParams.get("next");
      router.push(next ? decodeURIComponent(next) : "/");
    } catch {
      setError("Identifiants invalides.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-bg text-ink">
      <Panel className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">
          CLAIRE<span className="text-accent"> Studio</span>
        </h1>
        <p className="mb-4 text-sm text-ink-muted">Connectez-vous pour annoter.</p>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label="Identifiant" htmlFor="username">
            <input
              id="username"
              data-testid="login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Mot de passe" htmlFor="password">
            <input
              id="password"
              type="password"
              data-testid="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm"
            />
          </Field>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" variant="primary" disabled={loading} data-testid="login-submit">
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
          <button type="button" className="text-xs text-ink-muted hover:underline">
            Se connecter via SSO (à venir)
          </button>
        </form>
        <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
          <Link href="/signup" data-testid="login-to-signup" className="text-accent hover:underline">
            Créer un compte
          </Link>
          <Link href="/forgot-password" className="hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
      </Panel>
    </div>
  );
}
