"use client";

/** Création de compte (chantier E). Public. Après inscription : e-mail de vérification. */

import Link from "next/link";
import { useState } from "react";
import { register } from "@/lib/api/endpoints";
import { Button, Field, Panel } from "@/components/ui/primitives";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register({ username, email, password, displayName: displayName || undefined });
      setDone(true);
    } catch (err: unknown) {
      // Remonte les messages de validation backend (e-mail/username pris, mdp faible).
      const body =
        err && typeof err === "object" && "body" in err
          ? (err as { body?: unknown }).body
          : undefined;
      const first =
        body && typeof body === "object"
          ? Object.values(body as Record<string, unknown>)
              .flat()
              .find((v) => typeof v === "string")
          : undefined;
      setError(
        typeof first === "string"
          ? first
          : "Inscription impossible. Vérifiez les champs et réessayez.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="theme-light flex min-h-screen items-center justify-center bg-bg px-4 text-ink">
      <Panel className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">
          <span className="font-display font-light tracking-[0.12em]">Pactiva</span>
        </h1>
        {done ? (
          <div data-testid="signup-done" className="mt-4 text-sm text-ink-muted">
            <p className="font-medium text-ink">Compte créé 🎉</p>
            <p className="mt-2">
              Un e-mail de vérification a été envoyé à <strong>{email}</strong>. Ouvrez
              le lien qu'il contient pour activer votre compte, puis connectez-vous.
            </p>
            <Link href="/login" className="mt-4 inline-block text-accent hover:underline">
              Aller à la connexion →
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-muted">Créez votre compte annotateur.</p>
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <Field label="Identifiant" htmlFor="su-username">
                <input
                  id="su-username"
                  data-testid="signup-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm"
                />
              </Field>
              <Field label="E-mail" htmlFor="su-email">
                <input
                  id="su-email"
                  type="email"
                  data-testid="signup-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm"
                />
              </Field>
              <Field label="Nom affiché (optionnel)" htmlFor="su-display">
                <input
                  id="su-display"
                  data-testid="signup-display"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm"
                />
              </Field>
              <Field label="Mot de passe" htmlFor="su-password">
                <input
                  id="su-password"
                  type="password"
                  data-testid="signup-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm"
                />
              </Field>
              {error && (
                <p data-testid="signup-error" className="text-sm text-red-400">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" disabled={loading} data-testid="signup-submit">
                {loading ? "Création…" : "Créer mon compte"}
              </Button>
            </form>
            <p className="mt-4 text-xs text-ink-muted">
              Déjà un compte ?{" "}
              <Link href="/login" className="text-accent hover:underline">
                Se connecter
              </Link>
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}
