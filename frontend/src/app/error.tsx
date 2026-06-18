"use client";

/**
 * Error segment global (Next.js App Router). Capture les erreurs de rendu non
 * gérées de l'arbre applicatif et affiche un fallback avec stack en dev et un
 * bouton de récupération.
 */

import { useEffect } from "react";
import { DefaultErrorFallback } from "@/components/debug/ErrorBoundary";
import { IS_DEV } from "@/lib/env";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.error("[app/error] erreur de segment :", error);
    }
  }, [error]);

  return <DefaultErrorFallback error={error} reset={reset} />;
}
