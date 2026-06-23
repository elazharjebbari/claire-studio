/**
 * Métadonnées des niveaux de triage C1–C5 (protocole « confiance graduée »).
 *
 * SOURCE UNIQUE de couleur / glyphe / libellé / signification — partagée par la carte de
 * suggestion, les compteurs, la légende, la modale d'aide et l'overlay document, pour que
 * le code couleur reste cohérent partout. Les niveaux dérivent de l'ACCORD INTER-JUGES
 * (jamais d'une confiance auto-déclarée) — cf. moteur `engine.ts`.
 */

import type { TriageLevel } from "./types";

export interface TriageLevelMeta {
  /** Libellé court (badge). */
  label: string;
  /** Couleur sémantique (hex) — accord décroissant C1→C5. */
  color: string;
  /** Glyphe compact. */
  icon: string;
  /** Signification méthodologique en une ligne (légende / tooltip). */
  meaning: string;
  /** Geste attendu de l'annotateur. */
  action: string;
}

export const TRIAGE_LEVEL_META: Record<TriageLevel, TriageLevelMeta> = {
  C1: {
    label: "Or",
    color: "#10B981", // émeraude — accord total
    icon: "●",
    meaning: "Accord total des juges sur le thème ET la frontière. Référence directe.",
    action: "Acceptable en lot, sans relecture.",
  },
  C2: {
    label: "Haute",
    color: "#84CC16", // lime — accord fort
    icon: "◐",
    meaning: "Thème unanime, mais frontière en majorité simple (ou override anti-refuge).",
    action: "Confirmer d'un clic ; fusion/scission de frontière possible.",
  },
  C3: {
    label: "Multi-label",
    color: "#8B5CF6", // violet — désaccord structuré (codé à part : ce n'est pas un « moins bon »)
    icon: "⧉",
    meaning: "Désaccord structuré entre deux thèmes liés (cluster) → chevauchement juridique réel.",
    action: "Valider le couple primaire + secondaire, ou permuter / retirer le 2ⁿᵈ.",
  },
  C4: {
    label: "Majorité",
    color: "#F59E0B", // ambre — à vérifier
    icon: "◑",
    meaning: "Thème majoritaire hors refuge/cluster, avec une dissidence minoritaire.",
    action: "Vérifier : garder la majorité ou choisir le candidat minoritaire.",
  },
  C5: {
    label: "Arbitrage",
    color: "#F43F5E", // rose/rouge — décision humaine
    icon: "⚖",
    meaning: "Désaccord fort ou éclaté (refuge/bruit), aucun gagnant net.",
    action: "Votre jugement fait foi : choisir un candidat, créer un multi, ou marquer indécidable.",
  },
};

export const TRIAGE_LEVELS_ORDER: TriageLevel[] = ["C1", "C2", "C3", "C4", "C5"];
