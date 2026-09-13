"use client";

/**
 * Panneau de lecture GOLD (centre) — présentation façon CONTRAT : les phrases contiguës
 * de même statut sont factorisées (liseré + cartouche de bloc) pour une lecture aérée ;
 * les conflits ressortent. Chaque phrase non décidée porte un rail « valider » à curseur
 * collant (la phrase suivante vient se placer sous le curseur, sans bouger la souris).
 */

import { useEffect, useRef } from "react";
import { Check, Lock, Split, Scale } from "lucide-react";
import { useGoldStore } from "@/store/goldStore";
import { blockKey, needsAttention } from "@/lib/gold/blocks";
import type { GoldSentenceRow } from "@/lib/gold/types";
import type { DisplayLang } from "@/lib/prefs/schema";
import { CANONICAL_TAXONOMY, type TaxonomyId } from "@/lib/taxonomy";
import { presentTheme } from "@/lib/taxonomy/presentation";

function accentClass(s: GoldSentenceRow): string {
  if (s.decided) return s.autoResolved ? "border-l-info" : "border-l-success";
  if (s.agreementClass === "divergence") return "border-l-danger";
  if (s.agreementClass === "majority") return "border-l-warning";
  return "border-l-line";
}

export interface GoldReadingProps {
  sentences: GoldSentenceRow[];
  /** VO / bilingue / FR — la traduction voyage avec la phrase (`textFr`). */
  displayLang?: DisplayLang;
  /** Grille de lecture des thèmes (affichage seulement). */
  taxonomy?: TaxonomyId;
  canDecide: boolean;
  onValidate: (index: number, clientY: number) => void;
}

export function GoldReadingPanel({
  sentences,
  displayLang = "orig",
  taxonomy = CANONICAL_TAXONOMY,
  canDecide,
  onValidate,
}: GoldReadingProps) {
  const selectedIndex = useGoldStore((s) => s.selectedIndex);
  const filter = useGoldStore((s) => s.filter);
  const parkY = useGoldStore((s) => s.parkY);
  const select = useGoldStore((s) => s.select);
  const hover = useGoldStore((s) => s.hover);
  const setParkY = useGoldStore((s) => s.setParkY);
  const scrollRef = useRef<HTMLDivElement>(null);

  const visible = sentences.filter((s) => {
    if (filter === "conflicts") return needsAttention(s);
    if (filter === "todo") return !s.decided;
    return true;
  });

  // Curseur collant : après une validation, aligner la phrase nouvellement sélectionnée
  // sur le Y du curseur (parkY) — la cible vient « sous la souris ».
  useEffect(() => {
    if (selectedIndex == null) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-gold-row="${selectedIndex}"]`);
    if (!el) return;
    if (parkY != null) {
      const rect = el.getBoundingClientRect();
      const delta = rect.top - parkY;
      const sc = scrollRef.current;
      if (sc && Math.abs(delta) > 1) sc.scrollTop += delta;
    } else {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, parkY, visible.length]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto bg-reading px-4 py-3" data-testid="gold-reading">
      <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
        {visible.map((s, i) => {
          const prev = visible[i - 1];
          const startsBlock = !prev || blockKey(prev) !== blockKey(s) || prev.index !== s.index - 1;
          const selected = s.index === selectedIndex;
          // Valider en 1 clic n'a de sens QUE pour une proposition qui reflète un accord.
          // Sur une égalité (départage alphabétique) ou un cas « manuel », adopter d'un clic
          // écrirait un thème arbitraire : l'arbitre doit choisir explicitement dans
          // l'inspecteur. Mesuré sur la campagne : les 462 cas manuels sont TOUS des égalités.
          const arbitraryProposal = s.tie === true || s.autoLevel === "manual";
          const showValidate =
            canDecide && !s.decided && !!s.proposedPrimary && !arbitraryProposal;
          return (
            <div key={s.index}>
              {startsBlock && s.decided && (
                <div className="mb-0.5 ml-3 mt-1 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                  {s.autoResolved ? "Auto" : "Décidé"} ·{" "}
                  <span style={{ color: presentTheme(s.primary, taxonomy).color }}>
                    {presentTheme(s.primary, taxonomy).label}
                  </span>
                </div>
              )}
              <div
                data-gold-row={s.index}
                data-testid={`gold-row-${s.index}`}
                data-selected={selected}
                onMouseEnter={() => hover(s.index)}
                onMouseLeave={() => hover(null)}
                onClick={() => {
                  setParkY(null); // clic direct = pas de curseur collant
                  select(s.index);
                }}
                className={`group relative flex cursor-pointer items-start gap-2 rounded-md border-l-2 py-1.5 pl-3 pr-2 text-sm transition-colors ${accentClass(
                  s,
                )} ${selected ? "bg-panel-muted ring-1 ring-accent/40" : "hover:bg-panel-muted/60"}`}
              >
                {/* Rail de validation (curseur collant) */}
                {showValidate && (
                  <button
                    type="button"
                    aria-label={`Valider la phrase ${s.index} et avancer`}
                    title="Valider la proposition et avancer"
                    data-testid={`gold-validate-${s.index}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onValidate(s.index, e.clientY);
                    }}
                    className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-success/50 bg-success/10 text-success opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Check size={11} aria-hidden />
                  </button>
                )}
                {!showValidate && (
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">
                    {s.decided ? (
                      <Check size={11} className="text-success" aria-hidden />
                    ) : arbitraryProposal && canDecide ? (
                      // À trancher explicitement : aucune proposition légitime à adopter.
                      <Scale
                        size={11}
                        className="text-danger"
                        role="img"
                        aria-label="À trancher : aucune proposition ne fait consensus"
                      />
                    ) : (
                      <Lock size={10} className="text-ink-muted" aria-hidden />
                    )}
                  </span>
                )}
                <span className="font-mono text-[10px] text-ink-muted">{s.index}</span>
                <span className="min-w-0 flex-1 text-ink">
                  {/* En mode FR, la traduction REMPLACE la VO (repli sur la VO si la
                      phrase n'est pas traduite — jamais de trou dans le contrat). */}
                  {displayLang === "fr" && s.textFr ? s.textFr : s.text}
                  {displayLang === "both" && s.textFr && (
                    <span
                      data-testid={`gold-translation-${s.index}`}
                      className="mt-0.5 block italic text-ink-muted"
                    >
                      {s.textFr}
                    </span>
                  )}
                  {displayLang === "fr" && !s.textFr && (
                    <span className="ml-1 text-[10px] not-italic text-ink-muted">(non traduite)</span>
                  )}
                </span>
                {!s.decided && needsAttention(s) && (
                  // Pastille ICÔNE (non-texte) plutôt qu'un mini-libellé coloré : exempte de
                  // la règle de contraste-texte WCAG 1.4.3, l'icône passe le 3:1 non-texte, et
                  // renforce le sens sans fatiguer l'œil. Nom accessible via role/aria-label.
                  s.agreementClass === "divergence" ? (
                    <Split
                      size={13}
                      className="shrink-0 text-danger"
                      role="img"
                      aria-label="Désaccord entre annotateurs (à trancher)"
                    />
                  ) : (
                    <Scale
                      size={13}
                      className="shrink-0 text-warning"
                      role="img"
                      aria-label="Majorité (à confirmer)"
                    />
                  )
                )}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="py-8 text-center text-sm text-ink-muted">Aucune phrase pour ce filtre.</div>
        )}
      </div>
    </div>
  );
}
