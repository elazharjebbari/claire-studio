"use client";

/**
 * LabHelpModal — explique COMMENT LIRE UNE PAGE DE RÉSULTATS du Lab. Patron
 * `GoldHelpModal` : modale accessible (role=dialog, aria-modal, Échap, clic extérieur,
 * focus déplacé puis restauré), 100 % tokens sémantiques, présentationnelle (pure).
 *
 * Message central : un chiffre ne se lit jamais nu — IC, dispersion, plafond
 * approximé, test nommé. Le détail vit dans le centre d'aide (groupe « Lab »).
 */

import { useEffect, useRef } from "react";
import { FlaskConical, Ruler, Shuffle, Target, TrendingUp } from "lucide-react";
import Link from "next/link";

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

export function LabHelpModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
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
        aria-labelledby="lab-help-title"
        data-testid="lab-help-modal"
        className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-elevated shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2
            id="lab-help-title"
            className="flex items-center gap-2 text-base font-semibold text-ink"
          >
            <FlaskConical size={18} className="text-accent" aria-hidden /> Lire une page de
            résultats
          </h2>
          <button
            ref={closeRef}
            type="button"
            data-testid="lab-help-close"
            aria-label="Fermer l'aide"
            onClick={onClose}
            className="rounded p-1 text-ink-muted hover:bg-panel-muted"
          >
            ✕
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm text-ink">
          <p className="text-[13px] text-ink-muted">
            Chaque expérience répond à une <strong className="text-ink">question
            décisionnelle</strong> (choisir, trancher, estimer) : sa page s&apos;ouvre sur
            l&apos;introduction (que teste-t-elle, pourquoi), puis le{" "}
            <strong className="text-ink">verdict</strong> — la réponse, avec son
            intervalle de confiance — puis la preuve.
          </p>

          <Row
            icon={<Ruler size={16} className="text-accent" aria-hidden />}
            title="Un chiffre ne se lit jamais nu"
            testid="lab-help-ci"
          >
            Chaque score porte son <strong className="text-ink">IC 95 %</strong>{" "}
            (rééchantillonnage par document — jamais par phrase) et sa{" "}
            <strong className="text-ink">dispersion inter-plis</strong> (±). Un résultat
            sans intervalle ne va pas dans l&apos;article.
          </Row>

          <Row
            icon={<Target size={16} className="text-warning" aria-hidden />}
            title="Le plafond humain est un repère, pas un adversaire"
            testid="lab-help-ceiling"
          >
            La bande grise est un <strong className="text-ink">taux d&apos;accord
            approximé</strong> entre annotateurs, avec sa propre incertitude. On écrit
            « X % du plafond approximé » — jamais « le modèle fait mieux que
            l&apos;humain ». Les plafonds diffèrent par tâche (κ 0,769 / α-MASI 0,635 /
            Jaccard 0,39 – 0,63).
          </Row>

          <Row
            icon={<Shuffle size={16} className="text-info" aria-hidden />}
            title="Comparer = test apparié, sur les mêmes plis"
            testid="lab-help-paired"
          >
            Deux modèles se comparent par{" "}
            <strong className="text-ink">Δ, IC du Δ, et p de permutation par
            document</strong>. Si l&apos;IC du Δ contient 0 : aucune différence démontrée
            à cet effectif. La plateforme refuse de comparer des plis différents.
          </Row>

          <Row
            icon={<TrendingUp size={16} className="text-success" aria-hidden />}
            title="L'exploratoire s'assume, l'extrapolation se borne"
            testid="lab-help-exploratory"
          >
            Le criblage affiche un classement et une règle de survie, pas une forêt de
            p-values. Les courbes ajustées sont en pointillés et la zone
            d&apos;extrapolation hachurée s&apos;arrête à ~2,5× l&apos;effectif observé —
            « la tendance suggère », jamais une promesse.
          </Row>

          <p className="border-t border-line pt-3 text-[12px] text-ink-muted">
            Détail complet, avec exemples :{" "}
            <Link href="/help?s=lab-metriques" className="text-accent hover:underline">
              Lire les métriques
            </Link>{" "}
            ·{" "}
            <Link href="/help?s=lab-experiences" className="text-accent hover:underline">
              Le parcours des expérimentations
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
