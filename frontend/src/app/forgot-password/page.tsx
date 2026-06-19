"use client";

/** Mot de passe oublié (chantier E). Public. Demande un lien de réinitialisation. */

import Link from "next/link";
import { useState } from "react";
import { requestPasswordReset } from "@/lib/api/endpoints";
import { Button, Field, Panel } from "@/components/ui/primitives";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset(email);
    } catch {
      /* anti-énumération : on n'expose jamais d'erreur liée à l'existence du compte */
    } finally {
      setLoading(false);
      setDone(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-ink">
      <Panel className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">
          CLAIRE<span className="text-accent"> Studio</span>
        </h1>
        {done ? (
          <div data-testid="forgot-done" className="mt-4 text-sm text-ink-muted">
            <p className="font-medium text-ink">Vérifiez votre boîte mail</p>
            <p className="mt-2">
              Si un compte est associé à <strong>{email}</strong>, un e-mail contenant
              un lien de réinitialisation vient d'être envoyé.
            </p>
            <Link href="/login" className="mt-4 inline-block text-accent hover:underline">
              Retour à la connexion →
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-muted">
              Saisissez votre e-mail pour recevoir un lien de réinitialisation.
            </p>
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <Field label="E-mail" htmlFor="fp-email">
                <input
                  id="fp-email"
                  type="email"
                  data-testid="forgot-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm"
                />
              </Field>
              <Button type="submit" variant="primary" disabled={loading} data-testid="forgot-submit">
                {loading ? "Envoi…" : "Envoyer le lien"}
              </Button>
            </form>
            <p className="mt-4 text-xs text-ink-muted">
              <Link href="/login" className="text-accent hover:underline">
                Retour à la connexion
              </Link>
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}
