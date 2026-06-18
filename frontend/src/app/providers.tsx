"use client";

/**
 * Providers globaux : react-query, application de la classe de thème sur <html>,
 * et démarrage conditionnel de MSW côté navigateur (mode mock MVP / E2E).
 *
 * Le démarrage de MSW est :
 *  - idempotent (singleton de module) → robuste au double-montage de React StrictMode (dev) ;
 *  - non bloquant en cas d'échec (.catch) → l'UI s'affiche même si le worker ne démarre pas,
 *    avec un filet de sécurité temporel ;
 *  - tracé (console) pour diagnostic.
 */

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/store/ui";
import { useApiErrorStore } from "@/store/apiErrors";
import { setAuthExpiredHandler } from "@/lib/api/client";
import { AuthGate } from "@/components/auth/AuthGate";
import { ApiErrorBanner } from "@/components/debug/ApiErrorBanner";
import { DebugBar } from "@/components/debug/DebugBar";
import { ErrorBoundary } from "@/components/debug/ErrorBoundary";
import { MOCKS_ENABLED, AUTO_LOGIN_ENABLED } from "@/lib/env";

function makeClient() {
  // Les caches partagent un onError qui alimente le store d'erreurs API
  // (surfaçage en bandeau/toast + console.error en dev).
  const onError = (error: unknown) => {
    useApiErrorStore.getState().push(error);
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
    },
  });
}

/** Applique la classe `.light`/`.dark` sur <html> dès que le thème change. */
function useApplyTheme() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.style.colorScheme = theme;
  }, [theme]);
}

/**
 * Démarre MSW au plus une fois pour tout le cycle de vie de la page.
 * Renvoie une promesse résolue quand le worker est prêt (ou en échec géré).
 */
let mswStartPromise: Promise<void> | null = null;
function startMocksOnce(): Promise<void> {
  if (mswStartPromise) return mswStartPromise;
  mswStartPromise = import("@/mocks/browser")
    .then(({ worker }) => worker.start({ onUnhandledRequest: "bypass" }))
    .then(() => {
      // eslint-disable-next-line no-console
      console.info("[MSW] worker prêt (mode mock activé).");
    })
    .catch((err: unknown) => {
      // On ne bloque jamais l'UI : on logge et on continue.
      // eslint-disable-next-line no-console
      console.error("[MSW] échec du démarrage du worker — l'UI continue sans mock.", err);
    });
  return mswStartPromise;
}

/** Indique si l'app peut rendre (mocks prêts, désactivés, ou échec géré / délai dépassé). */
function useMocks(): boolean {
  const [ready, setReady] = useState(!MOCKS_ENABLED);
  useEffect(() => {
    if (!MOCKS_ENABLED) return;
    let active = true;
    const finish = () => active && setReady(true);
    void startMocksOnce().then(finish);
    // Filet de sécurité : ne jamais rester bloqué sur l'écran de démarrage > 4 s.
    const safety = setTimeout(finish, 4000);
    return () => {
      active = false;
      clearTimeout(safety);
    };
  }, []);
  return ready;
}

/**
 * Branche la reprise après 401 terminal (mode réel uniquement).
 * - Auto-login activé → on recharge la page : l'AuthGate relance un login propre.
 * - Sinon → redirection vers /login en mémorisant la page courante.
 * En mode mock, aucun handler n'est branché (auth désactivée → E2E intacts).
 */
function useAuthExpiredRedirect() {
  useEffect(() => {
    if (MOCKS_ENABLED) return;
    setAuthExpiredHandler(() => {
      if (typeof window === "undefined") return;
      if (AUTO_LOGIN_ENABLED) {
        window.location.reload();
      } else if (window.location.pathname !== "/login") {
        const next = encodeURIComponent(window.location.pathname);
        window.location.assign(`/login?next=${next}`);
      }
    });
    return () => setAuthExpiredHandler(null);
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<QueryClient>();
  if (!clientRef.current) clientRef.current = makeClient();
  useApplyTheme();
  useAuthExpiredRedirect();
  const mocksReady = useMocks();

  if (!mocksReady) {
    return (
      <div
        data-testid="mocks-booting"
        className="flex h-screen items-center justify-center text-ink-muted"
      >
        Démarrage de l’environnement de démonstration…
      </div>
    );
  }

  return (
    <QueryClientProvider client={clientRef.current}>
      <ErrorBoundary>
        <AuthGate>{children}</AuthGate>
      </ErrorBoundary>
      <ApiErrorBanner />
      <DebugBar />
    </QueryClientProvider>
  );
}
