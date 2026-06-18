"use client";

/**
 * Providers globaux : react-query, application de la classe de thème sur <html>,
 * et démarrage conditionnel de MSW côté navigateur (mode mock MVP).
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/store/ui";

function makeClient() {
  return new QueryClient({
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

/** Démarre MSW une seule fois si les mocks sont activés. */
function useMocks(): boolean {
  const [ready, setReady] = useState(process.env.NEXT_PUBLIC_ENABLE_MOCKS !== "true");
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_MOCKS !== "true") return;
    let cancelled = false;
    void import("@/mocks/browser").then(({ worker }) =>
      worker.start({ onUnhandledRequest: "bypass" }).then(() => {
        if (!cancelled) setReady(true);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<QueryClient>();
  if (!clientRef.current) clientRef.current = makeClient();
  useApplyTheme();
  const mocksReady = useMocks();

  if (!mocksReady) {
    return (
      <div className="flex h-screen items-center justify-center text-ink-muted">
        Démarrage de l’environnement de démonstration…
      </div>
    );
  }

  return <QueryClientProvider client={clientRef.current}>{children}</QueryClientProvider>;
}
