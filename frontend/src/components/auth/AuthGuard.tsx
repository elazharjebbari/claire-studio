"use client";

/**
 * Wrapper client appliquant la garde d'authentification (useAuthGuard) autour
 * des routes applicatives. En mode mock ou avec auto-login, la garde est inerte
 * et rend directement les enfants. En mode réel sans auto-login et sans token,
 * elle redirige vers /login (rendu intermédiaire neutre pendant la redirection).
 */

import { useAuthGuard } from "./useAuthGuard";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const allowed = useAuthGuard();
  if (!allowed) {
    return (
      <div
        data-testid="auth-redirecting"
        className="flex h-screen items-center justify-center text-ink-muted"
      >
        Redirection vers la connexion…
      </div>
    );
  }
  return <>{children}</>;
}
