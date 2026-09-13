"use client";

/**
 * Légende de la taxonomie courante — et, pour chaque classe fusionnée, CE QU'ELLE CONTIENT.
 *
 * C'est la pièce qui rend une taxonomie fusionnée utilisable : sans elle, « CONTENT_IP »
 * est un mot opaque. Ici, chaque macro-catégorie énumère ses thèmes T20 d'origine, avec
 * leurs couleurs, et porte la justification mesurée de la fusion.
 */

import { Layers } from "lucide-react";

import { Disclosure } from "@/components/ui/Disclosure";
import { getTaxonomy, type TaxonomyId } from "@/lib/taxonomy";
import { presentTheme } from "@/lib/taxonomy/presentation";
import { getThemeToken } from "@/lib/tokens";

export interface TaxonomyLegendProps {
  taxonomy: TaxonomyId;
  /** Effectifs par catégorie projetée (facultatif) : rend la légende quantitative. */
  counts?: Record<string, number>;
  defaultOpen?: boolean;
}

export function TaxonomyLegend({ taxonomy, counts, defaultOpen = false }: TaxonomyLegendProps) {
  const spec = getTaxonomy(taxonomy);
  const merged = spec.categories.filter((c) => c.members.length > 1).length;

  return (
    <Disclosure
      testId="taxonomy-legend"
      icon={<Layers size={13} aria-hidden />}
      summary={`${spec.label} — ${spec.categories.length} classes${
        merged ? `, dont ${merged} fusionnées` : ""
      }`}
      defaultOpen={defaultOpen}
    >
      <div className="flex flex-col gap-2">
        <p className="text-[12px] text-ink-muted">{spec.rationale}</p>
        <ul className="flex flex-col gap-1.5">
          {spec.categories.map((category) => {
            const p = presentTheme(category.members[0]!, taxonomy);
            const Icon = p.icon;
            const n = counts?.[category.code];
            return (
              <li
                key={category.code}
                data-testid={`legend-${category.code}`}
                className="rounded-md border border-line bg-panel-muted/30 px-2 py-1.5"
              >
                <div className="flex items-center gap-1.5">
                  <Icon size={13} style={{ color: category.color }} aria-hidden />
                  <span className="text-[13px] font-medium text-ink">{category.label}</span>
                  {category.members.length > 1 && (
                    <span
                      className="rounded-full border px-1.5 text-[10px] font-mono"
                      style={{
                        color: category.color,
                        borderColor: `${category.color}55`,
                        backgroundColor: `${category.color}1A`,
                      }}
                    >
                      ⊕{category.members.length}
                    </span>
                  )}
                  {n != null && (
                    <span className="ml-auto font-mono text-[11px] text-ink-muted">{n}</span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-ink-muted">{category.description}</p>
                {category.members.length > 1 && (
                  <>
                    {/* La TRACE vers la source canonique : ce que la classe contient. */}
                    <ul
                      data-testid={`legend-members-${category.code}`}
                      className="mt-1 flex flex-wrap gap-1"
                    >
                      {category.members.map((member) => (
                        <li
                          key={member}
                          className="inline-flex items-center gap-1 rounded border border-line px-1 py-0.5 text-[10px] text-ink-muted"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: getThemeToken(member).color }}
                            aria-hidden
                          />
                          {getThemeToken(member).label}
                        </li>
                      ))}
                    </ul>
                    {category.rationale && (
                      <p className="mt-1 text-[11px] italic text-ink-muted">{category.rationale}</p>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Disclosure>
  );
}
