"use client";

/**
 * Panneau de lecture GOLD (centre) — présentation façon CONTRAT : les phrases contiguës
 * de même statut sont factorisées (liseré + cartouche de bloc) pour une lecture aérée ;
 * les conflits ressortent. Chaque phrase non décidée porte un rail « valider » à curseur
 * collant (la phrase suivante vient se placer sous le curseur, sans bouger la souris).
 */

import { useEffect, useRef } from "react";
import { Check, Lock } from "lucide-react";
import { useGoldStore } from "@/store/goldStore";
import { blockKey, needsAttention } from "@/lib/gold/blocks";
import type { GoldSentenceRow } from "@/lib/gold/types";

function accentClass(s: GoldSentenceRow): string {
  if (s.decided) return s.autoResolved ? "border-l-info" : "border-l-success";
  if (s.agreementClass === "divergence" || s.humanDissent) return "border-l-danger";
  if (s.agreementClass === "majority") return "border-l-warning";
  return "border-l-line";
}

export interface GoldReadingProps {
  sentences: GoldSentenceRow[];
  canDecide: boolean;
  onValidate: (index: number, clientY: number) => void;
}

export function GoldReadingPanel({ sentences, canDecide, onValidate }: GoldReadingProps) {
  const selectedIndex = useGoldStore((s) => s.selectedIndex);
  const filter = useGoldStore((s) => s.filter);
  const parkY = useGoldStore((s) => s.parkY);
  const select = useGoldStore((s) => s.select);
  const hover = useGoldStore((s) => s.hover);
  const setParkY = useGoldStore((s) => s.setParkY);
  const scrollRef = useRef<HTMLDivElement>(null);

  const visible = sentences.filter((s) => {
    if (filter === "conflicts") return needsAttention(s);
    if (filter === "undecided") return !s.decided;
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
          // Valider n'a de sens que s'il existe une proposition à adopter.
          const showValidate = canDecide && !s.decided && !!s.proposedPrimary;
          return (
            <div key={s.index}>
              {startsBlock && s.decided && (
                <div className="mb-0.5 ml-3 mt-1 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                  {s.autoResolved ? "Auto" : "Décidé"} · <span className="font-mono">{s.primary}</span>
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
                    ) : (
                      <Lock size={10} className="text-ink-muted" aria-hidden />
                    )}
                  </span>
                )}
                <span className="font-mono text-[10px] text-ink-muted">{s.index}</span>
                <span className="min-w-0 flex-1 text-ink">{s.text}</span>
                {!s.decided && needsAttention(s) && (
                  <span
                    className={`shrink-0 rounded px-1 text-[10px] font-semibold ${
                      s.agreementClass === "divergence" || s.humanDissent
                        ? "bg-danger/15 text-danger"
                        : "bg-warning/15 text-warning"
                    }`}
                  >
                    {s.humanDissent ? "≠LLM" : s.agreementClass === "divergence" ? "split" : "maj."}
                  </span>
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
