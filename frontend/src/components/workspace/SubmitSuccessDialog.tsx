"use client";

/**
 * SubmitSuccessDialog (point 1) — confirmation de SUCCÈS après soumission. Affichée
 * dès que l'annotation est passée en « soumise » (version figée créée). Elle :
 *  - confirme explicitement que la soumission a fonctionné (rassure l'annotateur) ;
 *  - explique que le document est désormais VERROUILLÉ (lecture seule) ;
 *  - offre un déverrouillage immédiat (rouvre en brouillon pour reprendre l'annotation).
 *
 * Modal accessible (role=dialog, Échap, clic extérieur, focus initial sur « Fermer »).
 */

import { useEffect } from "react";
import { CheckCircle2, Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export function SubmitSuccessDialog({
  versionName,
  onClose,
  onUnlock,
}: {
  /** Nom de la version soumise (affiché pour confirmer ce qui a été figé). */
  versionName?: string;
  onClose: () => void;
  /** Déverrouillage immédiat (rouvre en brouillon). Absent si non déverrouillable ici. */
  onUnlock?: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Annotation soumise"
        data-testid="submit-success-dialog"
        className="w-full max-w-md rounded-xl border border-line bg-elevated p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
            <CheckCircle2 size={20} aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink">Annotation soumise</h2>
            <p className="text-xs text-ink-muted">
              Votre soumission a bien fonctionné
              {versionName ? (
                <>
                  {" "}— version <strong className="text-ink">« {versionName} »</strong> figée
                </>
              ) : null}
              . Une version immuable a été enregistrée et coexiste avec les précédentes.
            </p>
          </div>
        </div>

        {/* Explication du verrouillage automatique + possibilité de déverrouiller. */}
        <div
          data-testid="submit-success-lock-note"
          className="mb-4 flex items-start gap-2 rounded-md border border-slate-400/30 bg-slate-400/10 px-3 py-2 text-xs text-ink"
        >
          <Lock size={14} aria-hidden className="mt-0.5 shrink-0 text-slate-300" />
          <span>
            Le document est désormais <strong>verrouillé</strong> (lecture seule) pour
            préserver la version soumise. Vous pouvez le <strong>déverrouiller à tout
            moment</strong> pour reprendre l'annotation — il repassera alors en brouillon
            et vous pourrez le re-soumettre (une nouvelle version sera créée).
          </span>
        </div>

        <div className="flex justify-end gap-2">
          {onUnlock && (
            <Button
              variant="outline"
              data-testid="submit-success-unlock"
              onClick={() => {
                onUnlock();
                onClose();
              }}
            >
              <LockOpen size={14} aria-hidden className="mr-1.5" />
              Déverrouiller
            </Button>
          )}
          <Button
            autoFocus
            variant="primary"
            data-testid="submit-success-close"
            onClick={onClose}
          >
            Compris, garder verrouillé
          </Button>
        </div>
      </div>
    </div>
  );
}
