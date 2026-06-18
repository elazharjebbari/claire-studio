"use client";

/**
 * Barre d'état dev (DebugBar) — bandeau bas d'écran montrant : API base, état
 * /health (vert/rouge + nb docs/annotations), utilisateur courant (/me) et mode
 * (réel/mock). Rafraîchissable.
 *
 * VISIBILITÉ : rendue uniquement si `DEBUG_BAR_ENABLED` (mode réel OU
 * NEXT_PUBLIC_DEBUG=true). En mode mock pur (E2E Playwright), elle n'est PAS
 * montée → aucun risque d'intercepter les clics des tests. Par sécurité, le
 * conteneur reste `pointer-events-none` (seuls les contrôles sont cliquables).
 */

import { useHealth, useMe } from "@/lib/api/hooks";
import { API_BASE } from "@/lib/api/client";
import { MOCKS_ENABLED, DEBUG_BAR_ENABLED } from "@/lib/env";

export function DebugBar() {
  // Garde-fou runtime : ne rien rendre si désactivé (notamment en mode mock).
  if (!DEBUG_BAR_ENABLED) return null;
  return <DebugBarInner />;
}

function DebugBarInner() {
  const health = useHealth();
  const me = useMe();

  const healthOk = health.isSuccess && health.data?.status != null;
  const dotColor = health.isLoading
    ? "bg-amber-400"
    : healthOk
      ? "bg-emerald-500"
      : "bg-red-500";

  return (
    <div
      data-testid="debug-bar"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[150] flex items-center gap-3 border-t border-line bg-panel/95 px-3 py-1 text-[11px] text-ink-muted backdrop-blur"
    >
      <span className="font-semibold uppercase tracking-wide text-ink">
        {MOCKS_ENABLED ? "MOCK" : "RÉEL"}
      </span>
      <span className="font-mono">{API_BASE}</span>
      <span className="flex items-center gap-1">
        <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} aria-hidden />
        health:
        {health.isLoading
          ? " …"
          : healthOk
            ? ` ${health.data?.status} (${health.data?.documents} docs / ${health.data?.annotations} annot.)`
            : " hors ligne"}
      </span>
      <span>
        user: {me.isSuccess ? (me.data?.username ?? me.data?.id) : me.isLoading ? "…" : "—"}
      </span>
      <button
        type="button"
        onClick={() => {
          void health.refetch();
          void me.refetch();
        }}
        className="pointer-events-auto ml-auto rounded border border-line bg-panel px-2 py-0.5 hover:bg-panel-muted"
      >
        Rafraîchir
      </button>
    </div>
  );
}
