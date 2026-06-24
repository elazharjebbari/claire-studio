"use client";

/**
 * SubmissionProgressDialog — soumission en TÂCHE DE FOND avec barre de progression et
 * notification de fin. Remplace le message d'erreur bloquant : l'utilisateur voit l'avancement
 * en 3 étapes (enregistrement → version figée → publication) puis est notifié du succès
 * (SubmitSuccessDialog) ou de l'échec (état d'erreur ici, avec « Réessayer »).
 *
 * Présentation only : la machine à états vit dans WorkspaceToolbar.
 */

import { Check, Loader2, AlertTriangle, X } from "lucide-react";

export type SubmissionPhase = "save" | "version" | "publish";

const STEPS: { key: SubmissionPhase; label: string }[] = [
  { key: "save", label: "Enregistrement des modifications" },
  { key: "version", label: "Création de la version figée" },
  { key: "publish", label: "Publication de l'annotation" },
];

// % de remplissage de la barre par étape EN COURS (progression visible et continue).
const PHASE_PCT: Record<SubmissionPhase, number> = { save: 33, version: 66, publish: 92 };

export function SubmissionProgressDialog({
  phase,
  error,
  onRetry,
  onClose,
}: {
  phase: SubmissionPhase;
  /** Message d'échec (null = en cours). */
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const activeIndex = STEPS.findIndex((s) => s.key === phase);
  const pct = error ? PHASE_PCT[phase] : PHASE_PCT[phase];

  return (
    <div
      className="fixed inset-0 z-[68] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        // Pendant la progression on ne ferme pas par mégarde ; en erreur, clic extérieur ferme.
        if (error && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Publication de l'annotation"
        aria-busy={!error}
        data-testid="submission-progress"
        data-phase={phase}
        data-state={error ? "error" : "running"}
        className="w-full max-w-md rounded-xl border border-line bg-elevated p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-start gap-3">
          <span
            className={
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full " +
              (error ? "bg-red-400/15 text-red-300" : "bg-accent/15 text-accent")
            }
          >
            {error ? <AlertTriangle size={20} aria-hidden /> : <Loader2 size={20} aria-hidden className="animate-spin motion-reduce:animate-none" />}
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink">
              {error ? "La publication a échoué" : "Publication en cours…"}
            </h2>
            <p className="text-xs text-ink-muted">
              {error
                ? "Aucune donnée n'a été perdue — vous pouvez réessayer."
                : "Votre annotation est publiée en arrière-plan, sans perte de données."}
            </p>
          </div>
        </div>

        {/* Barre de progression */}
        <div
          className="mb-3 h-2 overflow-hidden rounded-full bg-panel-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avancement de la publication"
        >
          <div
            className={
              "h-full rounded-full transition-[width] duration-500 ease-out " +
              (error ? "bg-red-400/70" : "bg-accent")
            }
            style={{ width: `${pct}%` }}
            aria-hidden
          />
        </div>

        {/* Étapes */}
        <ol className="mb-1 flex flex-col gap-1.5">
          {STEPS.map((s, i) => {
            const done = !error && i < activeIndex;
            const active = i === activeIndex;
            return (
              <li
                key={s.key}
                data-testid={`submission-step-${s.key}`}
                className={
                  "flex items-center gap-2 text-sm " +
                  (active ? "text-ink" : done ? "text-emerald-300" : "text-ink-muted")
                }
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {done ? (
                    <Check size={14} aria-hidden className="text-emerald-400" />
                  ) : active && !error ? (
                    <Loader2 size={13} aria-hidden className="animate-spin motion-reduce:animate-none text-accent" />
                  ) : active && error ? (
                    <AlertTriangle size={13} aria-hidden className="text-red-300" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-muted/50" />
                  )}
                </span>
                {s.label}
              </li>
            );
          })}
        </ol>

        {error && (
          <div
            data-testid="submission-error"
            role="alert"
            className="mt-2 rounded-md border border-red-400/50 bg-red-400/10 px-3 py-2 text-xs text-red-200"
          >
            {error}
          </div>
        )}

        {error && (
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              data-testid="submission-close"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-panel-muted"
            >
              <X size={14} aria-hidden /> Fermer
            </button>
            <button
              type="button"
              data-testid="submission-retry"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:brightness-110"
            >
              <Loader2 size={14} aria-hidden /> Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
