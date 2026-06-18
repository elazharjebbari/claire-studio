"use client";

/**
 * Bandeau/toast de surfaçage des erreurs API (système de debug front).
 *
 * Affiche les `ApiError` collectées par le store (status + endpoint + message),
 * avec auto-dismiss et bouton fermer. Positionné en overlay non bloquant
 * (`pointer-events-none` sur le conteneur, réactivé sur chaque toast) pour ne
 * jamais intercepter les clics des autres surfaces.
 */

import { useEffect } from "react";
import { useApiErrorStore, type ApiErrorEntry } from "@/store/apiErrors";

const AUTO_DISMISS_MS = 8000;

function Toast({ entry }: { entry: ApiErrorEntry }) {
  const dismiss = useApiErrorStore((s) => s.dismiss);
  useEffect(() => {
    const t = setTimeout(() => dismiss(entry.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [entry.id, dismiss]);

  return (
    <div
      role="alert"
      className="pointer-events-auto flex w-80 items-start gap-3 rounded-lg border border-red-500/50 bg-panel px-3 py-2 text-sm shadow-lg"
    >
      <span className="mt-0.5 inline-flex h-5 min-w-[1.75rem] items-center justify-center rounded bg-red-500/20 px-1 text-[11px] font-semibold text-red-400">
        {entry.status}
      </span>
      <div className="min-w-0 flex-1">
        {entry.endpoint && (
          <p className="truncate font-mono text-xs text-ink-muted">{entry.endpoint}</p>
        )}
        <p className="truncate text-ink">{entry.message}</p>
      </div>
      <button
        type="button"
        aria-label="Fermer"
        onClick={() => dismiss(entry.id)}
        className="shrink-0 rounded px-1 text-ink-muted hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}

export function ApiErrorBanner() {
  const errors = useApiErrorStore((s) => s.errors);
  if (errors.length === 0) return null;
  return (
    <div
      data-testid="api-error-banner"
      className="pointer-events-none fixed right-4 top-4 z-[200] flex flex-col gap-2"
    >
      {errors.map((e) => (
        <Toast key={e.id} entry={e} />
      ))}
    </div>
  );
}
