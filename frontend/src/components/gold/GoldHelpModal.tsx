"use client";

/**
 * GoldHelpModal — explique le SYSTÈME DE RÉSOLUTION DE CONFLITS et la CONSTRUCTION DU
 * DATASET GOLD. Modale accessible (role=dialog, aria-modal, Échap, clic extérieur), 100 %
 * tokens sémantiques (zéro hex). Présentationnelle (pure).
 *
 * Message central : la résolution est PUREMENT inter-annotateurs ; les LLM sont une
 * RÉFÉRENCE et ne votent jamais.
 */

import { useEffect, useRef } from "react";
import { Users, Bot, Sparkles, Gavel, Database, AlertTriangle, Check } from "lucide-react";

export interface GoldHelpModalProps {
  onClose: () => void;
}

function Row({
  icon,
  title,
  children,
  testid,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  testid?: string;
}) {
  return (
    <section data-testid={testid} className="flex gap-3">
      <span className="mt-0.5 shrink-0" aria-hidden>
        {icon}
      </span>
      <div>
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        <div className="mt-0.5 text-[12px] leading-snug text-ink-muted">{children}</div>
      </div>
    </section>
  );
}

export function GoldHelpModal({ onClose }: GoldHelpModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    // Déplace le focus DANS le dialog à l'ouverture, et le restaure à la fermeture (a11y).
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previouslyFocused?.focus?.();
    };
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
        aria-labelledby="gold-help-title"
        data-testid="gold-help-modal"
        className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-elevated shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 id="gold-help-title" className="flex items-center gap-2 text-base font-semibold text-ink">
            <Gavel size={18} className="text-gold" aria-hidden /> Résolution & construction du gold
          </h2>
          <button
            ref={closeRef}
            type="button"
            data-testid="gold-help-close"
            aria-label="Fermer l'aide"
            onClick={onClose}
            className="rounded p-1 text-ink-muted hover:bg-panel-muted"
          >
            ✕
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm text-ink">
          <p className="text-[13px] text-ink-muted">
            Le <strong className="text-ink">gold</strong> est le jeu de données de référence : pour chaque
            phrase, la décision qui fait foi, construite en <strong className="text-ink">arbitrant les
            désaccords entre annotateurs experts</strong>. L'objectif : trancher vite les cas sûrs et ne
            garder l'effort humain que sur les vrais conflits.
          </p>

          <Row
            icon={<Users size={16} className="text-gold" aria-hidden />}
            title="Le conflit est ENTRE ANNOTATEURS"
            testid="gold-help-interannot"
          >
            Un conflit n'existe que lorsque les annotateurs se contredisent. La{" "}
            <strong className="text-ink">comparaison se fait entre humains</strong>, jamais contre un modèle.
          </Row>

          <Row
            icon={<Bot size={16} className="text-info" aria-hidden />}
            title="Les LLM sont une RÉFÉRENCE, pas un votant"
            testid="gold-help-llm-reference"
          >
            Les propositions des modèles (claude/codex/mistral) sont affichées pour aider l'arbitre, mais{" "}
            <strong className="text-ink">n'entrent jamais dans la décision</strong> : un désaccord avec un
            modèle n'est <em>pas</em> un conflit.
          </Row>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Les 3 classes d'accord (entre annotateurs)
            </h3>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-[12px]">
                <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 font-medium text-success">
                  <Check size={11} aria-hidden /> Accord strict
                </span>
                <span className="text-ink-muted">tous d'accord (même thème).</span>
              </li>
              <li className="flex items-center gap-2 text-[12px]">
                <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 font-medium text-warning">
                  Majorité
                </span>
                <span className="text-ink-muted">une majorité claire (≥ 2/3) se dégage.</span>
              </li>
              <li className="flex items-center gap-2 text-[12px]">
                <span className="inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 font-medium text-danger">
                  <AlertTriangle size={11} aria-hidden /> Divergence
                </span>
                <span className="text-ink-muted">pas de majorité : vrai conflit à arbitrer.</span>
              </li>
            </ul>
          </section>

          <Row
            icon={<Sparkles size={16} className="text-info" aria-hidden />}
            title="Auto-résolution des cas sûrs"
            testid="gold-help-auto"
          >
            <strong className="text-ink">Accord strict → 1 clic</strong> (auto). <strong className="text-ink">Majorité
            ≥ 2/3 → auto</strong>. <strong className="text-ink">Divergence → arbitrage manuel</strong>. Les deux
            premiers seuils sont activables/désactivables dans la configuration de la campagne.
          </Row>

          <Row
            icon={<Gavel size={16} className="text-gold" aria-hidden />}
            title="Arbitrage"
            testid="gold-help-arbitrage"
          >
            Un seul arbitre à la fois (verrou exclusif, bail auto-expirant). On choisit le thème{" "}
            <strong className="text-ink">primaire</strong> et, si besoin, des{" "}
            <strong className="text-ink">secondaires</strong> (portés par ≥ 2 annotateurs). Une décision
            humaine prime toujours et survit aux recalculs. Qui peut arbitrer se règle nominativement dans
            la configuration.
          </Row>

          <Row
            icon={<Database size={16} className="text-success" aria-hidden />}
            title="Construction & export du gold"
            testid="gold-help-export"
          >
            Le gold est matérialisé <strong className="text-ink">phrase par phrase</strong> et recalculé sans
            jamais écraser une décision humaine. Il s'exporte (jsonl/csv) avec un bloc d'arbitrage
            (auto-résolu / décideur / commentaire) pour la traçabilité.
          </Row>
        </div>

        <footer className="border-t border-line px-5 py-2 text-[11px] text-ink-muted">
          En résumé : les annotateurs décident, les modèles éclairent, l'arbitre tranche les divergences.
        </footer>
      </div>
    </div>
  );
}
