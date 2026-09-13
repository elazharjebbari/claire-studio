"use client";

/**
 * Raccourcis clavier de l'ATELIER GOLD — conformes à la spécification d'origine
 * (docs/pactiva/dossier-gold/02-navigation/02-raccourcis.csv), dont aucun n'était
 * implémenté :
 *
 *   n / p   : phrase suivante / précédente À TRANCHER (la file de travail, pas les
 *             « conflits » : après auto-résolution, ceux-ci sont déjà réglés)
 *   1…9     : adopter le k-ième candidat affiché (ordre STABLE, numéros visibles à l'écran)
 *   Entrée  : adopter la proposition du moteur — REFUSÉE sur une égalité, où la
 *             « proposition » n'est qu'un départage alphabétique
 *   ?       : aide des raccourcis
 *
 * Trois garde-fous, calqués sur `useWorkspaceShortcuts` :
 *  - inertes quand le focus est dans un champ de saisie (sinon écrire une justification
 *    déclencherait des décisions) ;
 *  - inertes sans le verrou d'arbitrage — MÊME condition que les boutons (`canDecide`),
 *    aucune divergence possible entre le chemin clavier et le chemin souris ;
 *  - aucune touche destructrice : tout raccourci a un équivalent visible à l'écran.
 */

import { useEffect } from "react";

export interface GoldShortcutCallbacks {
  /** Navigation vers la phrase suivante / précédente à trancher. */
  onNext: () => void;
  onPrev: () => void;
  /** Adopter le k-ième candidat (0-based). */
  onAdoptCandidate: (position: number) => void;
  /** Adopter la proposition du moteur (Entrée). */
  onAcceptProposal: () => void;
  onShowHelp?: () => void;
  /** Les raccourcis de DÉCISION sont actifs (verrou détenu, document arbitrable). */
  canDecide: boolean;
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable || tag === "select";
}

export function useGoldShortcuts(cb: GoldShortcutCallbacks) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Jamais d'interception d'une combinaison système ni d'une saisie en cours.
      if (isEditable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        cb.onShowHelp?.();
        return;
      }
      // Navigation : toujours disponible, même en lecture seule (on peut relire sans verrou).
      if (e.key === "n") {
        e.preventDefault();
        cb.onNext();
        return;
      }
      if (e.key === "p") {
        e.preventDefault();
        cb.onPrev();
        return;
      }

      if (!cb.canDecide) return; // décision : mêmes conditions que les boutons

      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        cb.onAdoptCandidate(Number(e.key) - 1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        cb.onAcceptProposal();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cb]);
}
