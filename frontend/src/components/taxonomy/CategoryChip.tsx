"use client";

/**
 * Pastille de CATÉGORIE — affiche un thème dans la taxonomie de lecture courante.
 *
 * Traçabilité : quand la catégorie est une FUSION, la pastille le signale (⊕ + nombre de
 * thèmes) et l'info-bulle énumère les thèmes T20 qu'elle contient. C'est la réponse à
 * « cette classe fusionnée, qu'est-ce qu'il y a dedans ? » sans quitter la lecture.
 *
 * L'appelant passe TOUJOURS un code T20 (la donnée canonique) : la projection est faite
 * par `presentTheme`, point de passage unique du rendu taxonomie-conscient. `data-theme`
 * reste en code CANONIQUE : c'est une clé, pas un affichage.
 */

import { presentTheme, presentationTooltip } from "@/lib/taxonomy/presentation";
import type { TaxonomyId } from "@/lib/taxonomy";

export interface CategoryChipProps {
  /** Code de thème T20 (canonique). */
  theme: string;
  taxonomy: TaxonomyId;
  /** `code` = code technique (compact, aligné) ; `label` = libellé lisible. */
  render?: "code" | "label";
  size?: "sm" | "md";
  withIcon?: boolean;
  testId?: string;
}

export function CategoryChip({
  theme,
  taxonomy,
  render = "label",
  size = "sm",
  withIcon = false,
  testId,
}: CategoryChipProps) {
  const p = presentTheme(theme, taxonomy);
  const Icon = p.icon;

  return (
    <span
      data-testid={testId ?? `category-chip-${p.code}`}
      data-theme={p.canonicalCode}
      data-merged={p.isMerged || undefined}
      title={presentationTooltip(theme, taxonomy)}
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-[12px]"
      }`}
      // Teinte du thème sur fond translucide de la même teinte : motif du projet, et seule
      // option correcte ici — un calcul de contraste sur un fond semi-transparent donnerait
      // une couleur fausse (il ignore le panneau qui transparaît dessous).
      style={{ backgroundColor: `${p.color}1A`, color: p.color, borderColor: `${p.color}55` }}
    >
      {withIcon ? (
        <Icon size={11} aria-hidden />
      ) : (
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
      )}
      <span className={render === "code" ? "font-mono" : ""}>
        {render === "code" ? p.code : p.label}
      </span>
      {p.isMerged && (
        // Signal DISCRET de fusion : le lecteur doit savoir qu'il lit une macro-catégorie.
        <span className="font-mono text-[10px] opacity-70" aria-hidden>
          ⊕{p.members.length}
        </span>
      )}
    </span>
  );
}
