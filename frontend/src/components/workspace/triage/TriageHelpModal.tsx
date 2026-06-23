"use client";

/**
 * TriageHelpModal — fenêtre d'aide expliquant le système d'aide à la décision (File de
 * triage). Modal accessible (role=dialog, aria-modal, Échap, clic extérieur). Contenu
 * 100 % déterministe : décrit comment les niveaux C1–C5 dérivent de l'ACCORD INTER-JUGES,
 * le multi-label, les frontières, les gestes et les raccourcis. Présentationnelle (pure).
 */

import { useEffect } from "react";

import { TRIAGE_LEVEL_META, TRIAGE_LEVELS_ORDER } from "@/lib/triage";

export interface TriageHelpModalProps {
  onClose: () => void;
}

export function TriageHelpModal({ onClose }: TriageHelpModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Comprendre la File de triage"
        data-testid="triage-help-modal"
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-line bg-elevated shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <span aria-hidden>🧮</span> Comprendre la File de triage
          </h2>
          <button
            type="button"
            data-testid="triage-help-close"
            aria-label="Fermer l'aide"
            onClick={onClose}
            className="rounded p-1 text-ink-muted hover:bg-panel-muted"
          >
            ✕
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm text-ink">
          <p className="text-[13px] text-ink-muted">
            Pour chaque phrase, la file propose une annotation <strong className="text-ink">dérivée de
            l'accord entre plusieurs juges LLM</strong> (et non d'une confiance auto-déclarée). Vous{" "}
            <strong className="text-ink">acceptez d'un geste</strong> ou ajustez facilement. L'explication
            est <strong className="text-ink">déterministe</strong> : elle vient de la règle, pas d'un nouveau modèle.
          </p>

          {/* Niveaux C1–C5 — code couleur + signification méthodologique */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Les 5 niveaux (accord décroissant)
            </h3>
            <ul className="space-y-2">
              {TRIAGE_LEVELS_ORDER.map((lvl) => {
                const m = TRIAGE_LEVEL_META[lvl];
                return (
                  <li key={lvl} data-testid={`triage-help-level-${lvl}`} className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-0.5 inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold"
                      style={{ backgroundColor: `${m.color}22`, color: m.color }}
                    >
                      {m.icon} {lvl}
                    </span>
                    <span className="text-[12px] leading-snug">
                      <span className="font-medium text-ink">{m.label}.</span>{" "}
                      <span className="text-ink-muted">{m.meaning}</span>{" "}
                      <span className="text-ink/70">→ {m.action}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Multi-label + frontières */}
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-panel p-3">
              <h3 className="mb-1 text-[12px] font-semibold text-ink">Multi-label</h3>
              <p className="text-[11px] text-ink-muted">
                Une clause porte <strong className="text-ink">1 thème primaire</strong> (✓) et,
                si les juges divergent de façon structurée, <strong className="text-ink">N secondaires</strong> (◻).
                Un thème « refuge » (préambule, divers) n'est <strong className="text-ink">jamais secondaire</strong>.
              </p>
            </div>
            <div className="rounded-lg border border-line bg-panel p-3">
              <h3 className="mb-1 text-[12px] font-semibold text-ink">Frontières</h3>
              <p className="text-[11px] text-ink-muted">
                L'ouverture de clause est <strong className="text-ink">dure ▮</strong> (accord net) ou{" "}
                <strong className="text-ink">molle ┄</strong> (majorité). Le chiffre indique le{" "}
                <em>support</em> inter-juges. Une frontière molle invite à vérifier fusion/scission.
              </p>
            </div>
          </section>

          {/* Gestes + raccourcis */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Gestes & raccourcis clavier
            </h3>
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-[12px]">
              <dt className="font-mono text-ink-muted">Entrée</dt>
              <dd className="text-ink-muted">Accepter / Confirmer / Valider la carte (hors C5).</dd>
              <dt className="font-mono text-ink-muted">j / k</dt>
              <dd className="text-ink-muted">Phrase suivante / précédente (le document suit).</dd>
              <dt className="font-mono text-ink-muted">A</dt>
              <dd className="text-ink-muted">Accepter en lot tous les C1 (or).</dd>
              <dt className="font-mono text-ink-muted">S</dt>
              <dd className="text-ink-muted">Accepter les phrases sélectionnées dans le document.</dd>
              <dt className="font-mono text-ink-muted">Échap</dt>
              <dd className="text-ink-muted">Fermer la file.</dd>
            </dl>
            <p className="mt-2 text-[11px] text-ink-muted">
              Sur une carte : <strong className="text-ink">permuter</strong> primaire/secondaire,{" "}
              <strong className="text-ink">retirer le 2ⁿᵈ</strong>, <strong className="text-ink">choisir</strong> un
              candidat, ou <strong className="text-ink">annuler un override</strong>. Tout est réversible (annuler).
            </p>
          </section>
        </div>

        <footer className="border-t border-line px-5 py-2 text-[11px] text-ink-muted">
          Accepter écrit la décision dans votre annotation et rafraîchit immédiatement le document.
        </footer>
      </div>
    </div>
  );
}
