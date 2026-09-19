"use client";

/**
 * AuthGate — orchestration de l'authentification au démarrage (MODE RÉEL UNIQUEMENT).
 *
 * Comportement :
 *  1. Mode mock → no-op total : rend immédiatement les enfants (E2E intacts).
 *  2. Mode réel + AUTO_LOGIN activé + aucun access token → lance un auto-login
 *     (singleton) AVANT de rendre l'app ; écran « Connexion… » pendant ; sur
 *     échec, message clair + bouton « Réessayer » + lien /login.
 *  3. Mode réel + AUTO_LOGIN désactivé + aucun token → ce composant rend les
 *     enfants tel quel ; la GARDE de redirection vers /login est portée par le
 *     layout applicatif (useAuthGuard).
 */

import { useCallback, useEffect, useState } from "react";
import { ensureAutoLogin } from "@/lib/auth";
import { tokenStore } from "@/lib/api/client";
import { AUTO_LOGIN_ENABLED, MOCKS_ENABLED } from "@/lib/env";
import { isPublicPath } from "@/lib/publicRoutes";

type Phase = "idle" | "booting" | "ready" | "error";

export function AuthGate({ children }: { children: React.ReactNode }) {
  // En mode mock, ou sans auto-login, l'AuthGate est transparent. Il l'est aussi sur les
  // surfaces PUBLIQUES (page reviewer `/`, présentation, projets publiés, connexion) : elles
  // n'ont besoin d'aucun compte et doivent rester lisibles même si le backend est arrêté.
  const publicRoute = typeof window !== "undefined" && isPublicPath(window.location.pathname);
  const needsAutoLogin = !MOCKS_ENABLED && AUTO_LOGIN_ENABLED && !publicRoute;

  const [phase, setPhase] = useState<Phase>(needsAutoLogin ? "idle" : "ready");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const attempt = useCallback(() => {
    setPhase("booting");
    setErrorMsg(null);
    ensureAutoLogin()
      .then(() => setPhase("ready"))
      .catch((err: unknown) => {
        const status =
          typeof err === "object" && err && "status" in err
            ? (err as { status?: number }).status
            : undefined;
        setErrorMsg(
          status === 429
            ? "Trop de tentatives de connexion (HTTP 429). Patientez ~1 min, puis Réessayer."
            : status
              ? `Échec de connexion (HTTP ${status}). Vérifiez les identifiants d’auto-login.`
              : "Connexion impossible. Le backend est-il démarré ?",
        );
        setPhase("error");
      });
  }, []);

  useEffect(() => {
    if (!needsAutoLogin) return;
    // Token déjà présent (ex. session précédente) → pas de login.
    if (tokenStore.getAccess()) {
      setPhase("ready");
      return;
    }
    if (phase === "idle") attempt();
  }, [needsAutoLogin, phase, attempt]);

  if (!needsAutoLogin || phase === "ready") return <>{children}</>;

  if (phase === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg text-ink">
        <div className="w-full max-w-sm rounded-lg border border-red-500/40 bg-panel p-5 text-center">
          <h1 className="text-lg font-semibold text-red-400">Connexion échouée</h1>
          <p className="mt-2 text-sm text-ink-muted">{errorMsg}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={attempt}
              className="inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:brightness-110"
            >
              Réessayer
            </button>
            <a
              href="/login"
              className="inline-flex items-center rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-medium hover:bg-panel-muted"
            >
              Page de connexion
            </a>
          </div>
        </div>
      </div>
    );
  }

  // idle / booting
  return (
    <div
      data-testid="auth-booting"
      className="flex h-screen items-center justify-center text-ink-muted"
    >
      Connexion…
    </div>
  );
}
