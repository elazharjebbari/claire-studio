"use client";

/**
 * QuickActionRail — rail d'actions rapides dans la gouttière GAUCHE de chaque phrase
 * (avant la piste de validation). Deux boutons ergonomiques :
 *  1. « Valider + suivant » : valide le modèle de pré-annotation courant pour la phrase et
 *     avance (le conteneur défile pour garder le bouton suivant SOUS le curseur → clics
 *     enchaînés sans bouger la souris ; logique de scroll côté DocumentPanel).
 *  2. « Recommandation » : clic = applique la règle du niveau de triage (C1–C4) ; survol =
 *     popover réutilisant SuggestionCard (chips, candidats, permuter/retirer/choisir). En C5
 *     (arbitrage), le clic ouvre la carte au lieu d'appliquer.
 *
 * Présentationnel : reçoit le résultat de triage et des callbacks ; aucune logique métier.
 * Code couleur partagé via TRIAGE_LEVEL_META (cohérent avec la file et l'overlay).
 */

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import type { ThemeTag } from "@/types/contract";
import { TRIAGE_LEVEL_META, type TriageResult } from "@/lib/triage";
import { cn } from "@/lib/cn";
import { SuggestionCard } from "./triage/SuggestionCard";

function labelsOf(r: TriageResult): ThemeTag[] {
  return r.labels.map((l) => ({ label: l.label, role: l.role, support: l.support }));
}

export interface QuickActionRailProps {
  index: number;
  /** Visible en clair (phrase focalisée) ; sinon révélé au survol de la ligne. */
  active: boolean;
  /** Résultat de triage de la phrase (null si triage indisponible). */
  result: TriageResult | null;
  /** Y a-t-il quelque chose à valider (clause existante ou run d'un juge) ? */
  canValidate: boolean;
  /** Valider le modèle courant + avancer (curseur collant). `clientY` = position du clic. */
  onValidateAdvance: (index: number, clientY: number) => void;
  /** Appliquer une décision de triage à la phrase. */
  onAcceptTriage: (
    index: number,
    themes: ThemeTag[],
    boundary: TriageResult["boundary"],
    level: TriageResult["level"],
  ) => void;
}

export function QuickActionRail({
  index,
  active,
  result,
  canValidate,
  onValidateAdvance,
  onAcceptTriage,
}: QuickActionRailProps) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // pour l'animation d'entrée du popover
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
  }, [open]);

  // Nettoyage du timer de fermeture au démontage (le rail est monté par phrase).
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const openSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const closeSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const meta = result ? TRIAGE_LEVEL_META[result.level] : null;

  const accept = (themes: ThemeTag[]) => {
    if (!result) return;
    onAcceptTriage(index, themes, result.boundary, result.level);
    setOpen(false);
  };
  const onSwap = (secondary: string) =>
    result &&
    accept(
      labelsOf(result).map((l) => ({
        ...l,
        role: l.label === secondary ? "primary" : l.role === "primary" ? "secondary" : l.role,
      })),
    );
  const onRemoveSecondary = () => {
    const p = result?.labels.find((l) => l.role === "primary");
    if (p) accept([{ label: p.label, role: "primary", support: p.support }]);
  };
  const onChoose = (label: string) => accept([{ label, role: "primary", support: 0 }]);
  const onUndoOverride = () => {
    const from = result?.override?.from;
    if (from) accept([{ label: from, role: "primary", support: 0 }]);
  };

  const onBadgeClick = () => {
    if (!result) return;
    if (result.level === "C5") setOpen(true); // arbitrage : pas d'application directe
    else accept(labelsOf(result));
  };

  return (
    <div
      className={cn(
        "absolute left-1 top-1 z-20 flex items-center gap-0.5 transition-opacity duration-150",
        // `pointer-events-none` quand masqué : un rail invisible ne doit pas intercepter les
        // clics destinés à la piste de validation située juste à droite.
        active
          ? "opacity-100"
          : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto",
      )}
    >
      {/* Bouton 1 — Valider + suivant (curseur collant) */}
      <button
        type="button"
        data-quickaction-validate={index}
        data-testid={`quick-validate-${index}`}
        disabled={!canValidate}
        title="Valider (modèle courant) + phrase suivante"
        aria-label={`Valider la phrase ${index} et passer à la suivante`}
        onClick={(e) =>
          // clavier (Enter/Espace) → clientY=0 : repli sur la position réelle du bouton.
          onValidateAdvance(index, e.clientY || e.currentTarget.getBoundingClientRect().top)
        }
        className={cn(
          "flex h-[18px] w-[18px] items-center justify-center rounded-md transition-transform",
          "bg-emerald-500/15 text-emerald-400 hover:scale-110 hover:bg-emerald-500/25 active:scale-95",
          "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100",
        )}
      >
        <Check size={12} aria-hidden />
      </button>

      {/* Bouton 2 — Recommandation triage (clic = règle, hover = carte) */}
      {result && meta && (
        <div className="relative" onMouseEnter={openSoon} onMouseLeave={closeSoon}>
          <button
            type="button"
            data-testid={`quick-suggest-${index}`}
            data-level={result.level}
            title={
              result.level === "C5"
                ? `${result.level} · ${meta.label} — ${meta.action}`
                : `Appliquer ${result.level} · ${meta.label} — ${meta.action}`
            }
            aria-label={`Recommandation ${result.level} ${meta.label} pour la phrase ${index}`}
            onClick={onBadgeClick}
            className="flex h-[18px] items-center gap-0.5 rounded-md px-1 text-[9px] font-semibold transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: `${meta.color}26`, color: meta.color }}
          >
            <span aria-hidden className="text-[8px]">{meta.icon}</span>
            {result.level}
          </button>

          {open && (
            <div
              role="dialog"
              aria-label={`Suggestion phrase ${index}`}
              data-testid={`quick-suggest-card-${index}`}
              onMouseEnter={openSoon}
              onMouseLeave={closeSoon}
              className={cn(
                // ml-1 (et non ml-2) pour réduire la zone morte de survol entre le bouton
                // et la carte ; le délai de fermeture de 120 ms couvre le reste.
                "absolute left-full top-0 z-50 ml-1 w-72 transition duration-150 ease-out",
                shown ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0",
              )}
            >
              <SuggestionCard
                result={result}
                onAccept={() => accept(labelsOf(result))}
                onSwap={onSwap}
                onRemoveSecondary={onRemoveSecondary}
                onChoose={onChoose}
                onUndoOverride={onUndoOverride}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
