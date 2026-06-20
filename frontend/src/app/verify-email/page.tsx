"use client";

/** Vérification d'e-mail (chantier E). Public. Lit ?token et appelle l'API. */

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { verifyEmail } from "@/lib/api/endpoints";
import { Panel } from "@/components/ui/primitives";

type Phase = "verifying" | "ok" | "error";

function VerifyEmailInner() {
  const token = useSearchParams().get("token");
  const [phase, setPhase] = useState<Phase>("verifying");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // évite le double-appel (StrictMode)
    ran.current = true;
    if (!token) {
      setPhase("error");
      return;
    }
    verifyEmail(token)
      .then(() => setPhase("ok"))
      .catch(() => setPhase("error"));
  }, [token]);

  return (
    <Panel className="w-full max-w-sm p-6 text-center" data-testid="verify-email">
      <h1 className="text-xl font-semibold text-ink">
        <span className="font-display font-light tracking-[0.12em]">Pactiva</span>
      </h1>
      {phase === "verifying" && (
        <p className="mt-4 text-sm text-ink-muted">Vérification en cours…</p>
      )}
      {phase === "ok" && (
        <div data-testid="verify-ok" className="mt-4 text-sm text-ink-muted">
          <p className="font-medium text-emerald-400">Adresse e-mail vérifiée ✓</p>
          <p className="mt-2">Votre compte est activé.</p>
          <Link href="/login" className="mt-4 inline-block text-accent hover:underline">
            Se connecter →
          </Link>
        </div>
      )}
      {phase === "error" && (
        <div data-testid="verify-error" className="mt-4 text-sm text-ink-muted">
          <p className="font-medium text-red-400">Lien invalide ou expiré</p>
          <p className="mt-2">
            Le lien de vérification est incorrect ou a expiré. Connectez-vous pour
            en demander un nouveau.
          </p>
          <Link href="/login" className="mt-4 inline-block text-accent hover:underline">
            Aller à la connexion →
          </Link>
        </div>
      )}
    </Panel>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="theme-light flex min-h-screen items-center justify-center bg-bg px-4 text-ink">
      <Suspense fallback={<p className="text-sm text-ink-muted">Chargement…</p>}>
        <VerifyEmailInner />
      </Suspense>
    </div>
  );
}
