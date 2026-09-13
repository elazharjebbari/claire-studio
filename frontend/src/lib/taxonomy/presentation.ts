/**
 * Présentation d'un thème DANS UNE TAXONOMIE — libellé, couleur, description, glyphe.
 *
 * Le rendu d'un thème passait par trois registres indépendants, tous indexés par le code
 * T20 : `getThemeToken` (libellé + couleur), `getThemeIcon` (glyphe) et
 * `getThemeDescription` (info-bulle). Une macro-catégorie (FRAMEWORK, CONTENT_IP…)
 * n'existe dans AUCUN des trois : sans ce module, elle s'afficherait en gris avec le
 * glyphe de repli et sans description.
 *
 * Ce module est le point de passage UNIQUE du rendu taxonomie-conscient : il résout la
 * catégorie dans la spécification (qui porte libellé, couleur et description des macros)
 * et dérive le glyphe du thème-TÊTE de la fusion — le premier membre déclaré, qui est
 * sémantiquement l'ancre du regroupement (FRAMEWORK → préambule, CONTENT_IP → licence).
 *
 * ⚠ RENDU SEULEMENT. Un code projeté ne doit JAMAIS redescendre dans un chemin
 * d'écriture : l'annotation et l'arbitrage s'écrivent toujours en T20 (source canonique).
 */

import type { LucideIcon } from "lucide-react";

import { categoryOfTheme, type TaxonomyCategory, type TaxonomyId } from "./index";
import { getThemeIcon } from "@/lib/themeIcons";
import { getThemeDescription } from "@/lib/themeDescriptions";
import { getThemeToken } from "@/lib/tokens";

export interface ThemePresentation {
  /** Code DANS la taxonomie de lecture (macro si fusion) — jamais à écrire en base. */
  code: string;
  /** Code T20 d'origine — la donnée canonique, à conserver comme clé et en écriture. */
  canonicalCode: string;
  label: string;
  description: string;
  color: string;
  icon: LucideIcon;
  /** Thèmes T20 contenus (≥ 2 ⇒ macro-catégorie). */
  members: string[];
  isMerged: boolean;
  isRefuge: boolean;
}

/** Rendu d'un thème T20 lu dans `taxonomy`. Toujours défini, même pour un code inconnu. */
export function presentTheme(t20Code: string, taxonomy: TaxonomyId): ThemePresentation {
  const category: TaxonomyCategory | null = categoryOfTheme(t20Code, taxonomy);

  if (!category) {
    // Code hors schéma : on le montre tel quel plutôt que de l'escamoter.
    const token = getThemeToken(t20Code);
    return {
      code: t20Code,
      canonicalCode: t20Code,
      label: token.label,
      description: getThemeDescription(t20Code),
      color: token.color,
      icon: getThemeIcon(t20Code),
      members: [t20Code],
      isMerged: false,
      isRefuge: false,
    };
  }

  const head = category.members[0] ?? t20Code;
  return {
    code: category.code,
    canonicalCode: t20Code,
    label: category.label,
    description: category.description,
    color: category.color,
    // Glyphe du thème-TÊTE : une macro sans icône serait indistinguable des autres.
    icon: getThemeIcon(head),
    members: [...category.members],
    isMerged: category.members.length > 1,
    isRefuge: !!category.isRefuge,
  };
}

/** Rendu d'une CATÉGORIE déjà projetée (quand on n'a plus le code T20 d'origine). */
export function presentCategory(code: string, taxonomy: TaxonomyId): ThemePresentation {
  return presentTheme(code, taxonomy);
}

/**
 * Info-bulle complète : ce que la catégorie couvre, et ce qu'elle contient en T20.
 * C'est la réponse en survol à « cette classe fusionnée, qu'y a-t-il dedans ? ».
 */
export function presentationTooltip(t20Code: string, taxonomy: TaxonomyId): string {
  const p = presentTheme(t20Code, taxonomy);
  if (!p.isMerged) return `${p.label} — ${p.description}`;
  const names = p.members.map((m) => getThemeToken(m).label).join(", ");
  return `${p.label} — ${p.description}\n\nRegroupe ${p.members.length} thèmes T20 : ${names}.`;
}
