"use client";

/**
 * ErrorBoundary réutilisable — capture les erreurs de rendu d'une sous-arborescence
 * React et affiche un fallback. En dev, le message et la stack sont visibles pour
 * accélérer le diagnostic ; en prod, un message neutre. Bouton « recharger ».
 */

import { Component, type ReactNode } from "react";
import { IS_DEV } from "@/lib/env";

interface Props {
  children: ReactNode;
  /** Fallback personnalisé (sinon fallback par défaut ci-dessous). */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary] erreur de rendu capturée :", error);
    }
  }

  reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return <DefaultErrorFallback error={error} reset={this.reset} />;
  }
}

export function DefaultErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div
      data-testid="error-boundary"
      role="alert"
      className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-4 bg-bg p-8 text-ink"
    >
      <div className="w-full max-w-lg rounded-lg border border-red-500/40 bg-panel p-5">
        <h2 className="text-lg font-semibold text-red-400">Une erreur est survenue</h2>
        <p className="mt-1 text-sm text-ink-muted">
          L’interface a rencontré un problème inattendu.
        </p>
        {IS_DEV && (
          <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-panel-muted p-3 text-xs text-ink">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-medium hover:bg-panel-muted"
          >
            Réessayer
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:brightness-110"
          >
            Recharger la page
          </button>
        </div>
      </div>
    </div>
  );
}
