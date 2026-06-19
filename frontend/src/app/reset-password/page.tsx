"use client";

/** Réinitialisation du mot de passe (chantier E). Public. Lit ?uid&token. */

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { confirmPasswordReset } from "@/lib/api/endpoints";
import { Button, Field, Panel } from "@/components/ui/primitives";

function errorMessage(err: unknown): string {
  const body =
    err && typeof err === "object" && "body" in err
      ? (err as { body?: unknown }).body
      : undefined;
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const fromPwd = Array.isArray(b.newPassword) ? b.newPassword[0] : undefined;
    if (typeof fromPwd === "string") return fromPwd;
    if (typeof b.detail === "string") return b.detail;
  }
  return "Lien invalide ou expiré, ou mot de passe non conforme.";
}

function ResetPasswordInner() {
  const sp = useSearchParams();
  const uid = sp.get("uid") ?? "";
  const token = sp.get("token") ?? "";
  const invalidLink = !uid || !token;

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await confirmPasswordReset(uid, token, password);
      setDone(true);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel className="w-full max-w-sm p-6" data-testid="reset-password">
      <h1 className="text-xl font-semibold">
        CLAIRE<span className="text-accent"> Studio</span>
      </h1>
      {done ? (
        <div data-testid="reset-done" className="mt-4 text-sm text-ink-muted">
          <p className="font-medium text-emerald-400">Mot de passe réinitialisé ✓</p>
          <Link href="/login" className="mt-4 inline-block text-accent hover:underline">
            Se connecter →
          </Link>
        </div>
      ) : invalidLink ? (
        <p data-testid="reset-invalid" className="mt-4 text-sm text-red-400">
          Lien de réinitialisation incomplet. Redemandez-en un depuis « Mot de passe
          oublié ».
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-muted">Choisissez un nouveau mot de passe.</p>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Field label="Nouveau mot de passe" htmlFor="rp-password">
              <input
                id="rp-password"
                type="password"
                data-testid="reset-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm"
              />
            </Field>
            {error && (
              <p data-testid="reset-error" className="text-sm text-red-400">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" disabled={loading} data-testid="reset-submit">
              {loading ? "Validation…" : "Réinitialiser"}
            </Button>
          </form>
        </>
      )}
    </Panel>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-ink">
      <Suspense fallback={<p className="text-sm text-ink-muted">Chargement…</p>}>
        <ResetPasswordInner />
      </Suspense>
    </div>
  );
}
