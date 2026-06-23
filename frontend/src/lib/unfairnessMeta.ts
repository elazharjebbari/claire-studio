/**
 * Métadonnées métier des injustices CLAUDETTE (source de vérité unique).
 *
 * Les tokens (`getUnfairnessToken`) ne portent que code + couleur ; ce module ajoute
 * le SENS (« clause qui… »), les THÈMES de segmentation associés (indicatif) et un
 * LEXIQUE de repérage intra-phrase (indicatif, non vérité terrain — cf. dossier design).
 * Pur, sans React, testable isolément.
 */

import type { UnfairnessCategory } from "@/types/contract";

export interface UnfairnessCategoryMeta {
  code: UnfairnessCategory;
  /** Libellé complet (FR). */
  label: string;
  /** Sens : « Clause qui… ». */
  sense: string;
  /** Codes de thèmes de segmentation souvent associés (correspondance INDICATIVE). */
  relatedThemes: string[];
  /** Repérage intra-phrase INDICATIF (tournures typiques) — jamais une vérité terrain. */
  keywords: RegExp;
}

export const UNFAIRNESS_META: Record<UnfairnessCategory, UnfairnessCategoryMeta> = {
  A: {
    code: "A",
    label: "Arbitrage",
    sense:
      "Clause qui impose l'arbitrage (renonce au tribunal), surtout s'il est hors pays ou payant.",
    relatedThemes: ["ARBITRATION_DISPUTES"],
    keywords: /\b(arbitrat\w*|binding arbitration|class action waiver)\b/i,
  },
  CH: {
    code: "CH",
    label: "Modification unilatérale",
    sense:
      "Clause qui autorise le fournisseur à modifier unilatéralement les conditions.",
    relatedThemes: ["MODIFICATION_OF_TERMS"],
    keywords: /\b(modif\w*|change\w*|amend\w*|at any time|revise\w*)\b/i,
  },
  CR: {
    code: "CR",
    label: "Retrait de contenu",
    sense:
      "Clause qui permet de supprimer ou bloquer le contenu de l'utilisateur, parfois sans préavis.",
    relatedThemes: ["USER_CONTENT", "ACCEPTABLE_USE"],
    keywords: /\b(remove\w*|delet\w*|block\w*|take down|disable\w*)\b/i,
  },
  J: {
    code: "J",
    label: "Juridiction compétente",
    sense:
      "Clause qui fixe le tribunal compétent (souvent au domicile du fournisseur).",
    relatedThemes: ["GOVERNING_LAW"],
    keywords: /\b(jurisdiction|courts? of|venue|exclusive jurisdiction)\b/i,
  },
  LAW: {
    code: "LAW",
    label: "Loi applicable",
    sense:
      "Clause qui impose la loi applicable (souvent celle du fournisseur).",
    relatedThemes: ["GOVERNING_LAW"],
    keywords: /\b(governed by|laws? of|governing law|in accordance with the laws)\b/i,
  },
  LTD: {
    code: "LTD",
    label: "Limitation de responsabilité",
    sense:
      "Clause qui limite ou exclut la responsabilité du fournisseur.",
    relatedThemes: ["LIMITATION_LIABILITY", "WARRANTY_DISCLAIMER"],
    keywords:
      /\b((not|no)\b[\w\s]{0,8}liable|liability|disclaim\w*|as is|as available|without warrant\w*)\b/i,
  },
  TER: {
    code: "TER",
    label: "Résiliation unilatérale",
    sense:
      "Clause qui permet une résiliation unilatérale, parfois sans motif ni préavis.",
    relatedThemes: ["TERMINATION"],
    keywords: /\b(terminat\w*|suspend\w*|discontinu\w*|at our discretion)\b/i,
  },
  USE: {
    code: "USE",
    label: "Contrat par l'usage",
    sense:
      "Clause qui répute le contrat accepté par le simple usage du service.",
    relatedThemes: ["PREAMBLE_SCOPE"],
    keywords: /\b(by using|continued use|using the service|by accessing)\b/i,
  },
};

export type SeverityTone = "low" | "mid" | "high";
export type SeverityIcon = "shield-check" | "alert-triangle" | "shield-alert";

export interface SeverityMeta {
  level: 1 | 2 | 3;
  label: string;
  /** Lecture courte du niveau. */
  reading: string;
  /** Échelle sémantique → classes de couleur (jamais un hex en dur). */
  tone: SeverityTone;
  icon: SeverityIcon;
}

export const SEVERITY_META: Record<1 | 2 | 3, SeverityMeta> = {
  1: {
    level: 1,
    label: "Faible",
    reading: "Mention présente mais équilibrée.",
    tone: "low",
    icon: "shield-check",
  },
  2: {
    level: 2,
    label: "Potentiellement injuste",
    reading: "Déséquilibre possible, à surveiller.",
    tone: "mid",
    icon: "alert-triangle",
  },
  3: {
    level: 3,
    label: "Clairement injuste",
    reading: "Déséquilibre net en défaveur de l'utilisateur.",
    tone: "high",
    icon: "shield-alert",
  },
};

export function unfairnessMeta(code: string): UnfairnessCategoryMeta | undefined {
  return UNFAIRNESS_META[code as UnfairnessCategory];
}

export function severityMeta(level: number): SeverityMeta | undefined {
  return SEVERITY_META[level as 1 | 2 | 3];
}
