"use client";

/**
 * AutoPrefillConsentDialog — demande de consentement à la 1ʳᵉ exécution manuelle du
 * pré-remplissage : « auto-exécuter ce modèle à chaque ouverture d'un document vierge ? ».
 * Montrée UNE seule fois par compte (drapeau `prefill.asked`). Quel que soit le choix, on
 * pose `asked=true` (ne se remontre jamais). Pattern de modale homogène (Échap, clic extérieur).
 */

import { useEffect } from "react";
import { WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { llmJudgeLabel } from "@/lib/llmJudges";

export function AutoPrefillConsentDialog({
  judge,
  onActivate,
  onDecline,
}: {
  judge: string;
  /** [Activer] → auto-prefill ON sur ce modèle (+ asked=true). */
  onActivate: () => void;
  /** [Non merci] → reste OFF (+ asked=true). Aussi appelé sur Échap / clic extérieur. */
  onDecline: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDecline();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDecline]);

  return (
    <div
      className="fixed inset-0 z-[66] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDecline();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Auto-pré-annotation"
        data-testid="auto-prefill-consent"
        className="w-full max-w-md rounded-xl border border-line bg-elevated p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <WandSparkles size={20} aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink">Auto-pré-annotation</h2>
            <p className="text-xs text-ink-muted">
              Exécuter automatiquement <strong className="text-ink">{llmJudgeLabel(judge)}</strong>{" "}
              à chaque ouverture d'un <strong className="text-ink">nouveau document vierge</strong> ?
              Votre annotation existante n'est jamais écrasée — seuls les documents non encore
              annotés sont pré-remplis. Vous pourrez désactiver à tout moment.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" data-testid="auto-prefill-decline" onClick={onDecline}>
            Non merci
          </Button>
          <Button variant="primary" data-testid="auto-prefill-activate" onClick={onActivate}>
            <WandSparkles size={14} aria-hidden className="mr-1.5" /> Activer
          </Button>
        </div>
      </div>
    </div>
  );
}
