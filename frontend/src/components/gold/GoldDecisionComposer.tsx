"use client";

/**
 * Composeur de décision GOLD — la décision COMPLÈTE d'une phrase : thème primaire
 * (y compris hors des votes), secondaires, et justification optionnelle.
 *
 * Pourquoi ce composant existe : sur les 462 cas manuels de la campagne, les trois
 * annotateurs proposent trois thèmes DIFFÉRENTS (égalité 1-1-1 mesurée sur 462/462).
 * L'arbitre doit donc pouvoir (a) trancher entre eux, (b) poser un QUATRIÈME thème
 * quand les trois se trompent, (c) décider les SECONDAIRES — que la politique de
 * campagne `advisory` ne promeut jamais d'office. Aucun de ces trois gestes n'était
 * possible : l'atelier ne proposait que les primaires votés et renvoyait toujours la
 * proposition de secondaires du moteur.
 *
 * Réutilise `ThemeMultiPicker` — la MÊME grille que l'atelier d'annotation (l'arbitre
 * la connaît déjà) : refuges jamais secondaires, recherche et navigation clavier.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, MessageSquarePlus, X } from "lucide-react";
import { ThemeMultiPicker } from "@/components/ui/ThemeMultiPicker";
import { Button } from "@/components/ui/primitives";
import { RULES } from "@/lib/triage";
import type { ThemeTag } from "@/types/contract";
import type { GoldSentenceRow } from "@/lib/gold/types";

export interface GoldDecisionComposerProps {
  sentence: GoldSentenceRow;
  disabled?: boolean;
  pending?: boolean;
  onSubmit: (primary: string, secondaries: string[], comment: string) => void;
}

/** Sélection initiale : la décision existante, sinon la proposition du moteur.
 *
 * EXCEPTION VOLONTAIRE : sur une ÉGALITÉ non encore tranchée, on part d'une grille VIDE.
 * Pré-cocher la « proposition » y reviendrait à pré-cocher le vainqueur alphabétique —
 * l'arbitre validerait sans s'en rendre compte le biais que l'avertissement dénonce.
 * Sur les 462 cas manuels de la campagne, c'est exactement la situation. */
function initialSelection(s: GoldSentenceRow): ThemeTag[] {
  if (!s.decided && s.tie) return [];
  const primary = s.decided ? s.primary : s.proposedPrimary;
  const secondaries = s.decided ? s.secondaries : s.proposedSecondaries;
  const out: ThemeTag[] = [];
  if (primary) out.push({ label: primary, role: "primary" });
  for (const code of secondaries ?? []) {
    if (code && code !== primary) out.push({ label: code, role: "secondary" });
  }
  return out;
}

export function GoldDecisionComposer({
  sentence,
  disabled,
  pending,
  onSubmit,
}: GoldDecisionComposerProps) {
  const [selection, setSelection] = useState<ThemeTag[]>(() => initialSelection(sentence));
  const [comment, setComment] = useState(sentence.comment ?? "");
  const [commentOpen, setCommentOpen] = useState(false);

  // Changer de phrase réinitialise le brouillon (jamais de fuite d'une phrase à l'autre).
  useEffect(() => {
    setSelection(initialSelection(sentence));
    setComment(sentence.comment ?? "");
    setCommentOpen(false);
  }, [sentence.index, sentence.decided, sentence.primary, sentence.comment, sentence.tie]); // eslint-disable-line react-hooks/exhaustive-deps

  const refuges = useMemo(() => new Set(RULES.refuges), []);
  const primary = selection.find((t) => t.role === "primary")?.label ?? "";
  const secondaries = selection.filter((t) => t.role === "secondary").map((t) => t.label);

  /** Les thèmes proposés par les annotateurs : repères visuels dans la grille. */
  const judgeHints = useMemo(() => {
    const hints: Record<string, string[]> = {};
    for (const a of sentence.annotators) {
      const initial = (a.displayName || a.voterId).slice(0, 1).toUpperCase();
      for (const code of [a.primary, ...a.secondaries]) {
        if (!code) continue;
        hints[code] = [...(hints[code] ?? []), initial];
      }
    }
    return hints;
  }, [sentence.annotators]);

  function toggle(code: string) {
    setSelection((prev) => {
      const existing = prev.find((t) => t.label === code);
      if (existing) return prev.filter((t) => t.label !== code);
      if (!prev.some((t) => t.role === "primary")) {
        return [...prev, { label: code, role: "primary" }];
      }
      // Un refuge ne peut JAMAIS être secondaire (même règle que l'atelier d'annotation).
      if (refuges.has(code)) return prev;
      return [...prev, { label: code, role: "secondary" }];
    });
  }

  function promote(code: string) {
    setSelection((prev) =>
      prev.map((t) => {
        if (t.label === code) return { ...t, role: "primary" as const };
        if (t.role === "primary") {
          // L'ancien primaire redevient secondaire — sauf si c'est un refuge (jamais secondaire).
          return refuges.has(t.label) ? null : { ...t, role: "secondary" as const };
        }
        return t;
      }).filter((t): t is ThemeTag => t !== null),
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="gold-decision-composer">
      <ThemeMultiPicker
        selection={selection}
        refuges={RULES.refuges}
        judgeHints={judgeHints}
        describeOnHover
        onToggle={toggle}
        onPromote={promote}
      />

      {/* Justification — facultative, mais c'est elle qui rend un arbitrage défendable
          en revue. Le champ est replié par défaut pour ne pas alourdir le geste. */}
      {commentOpen ? (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="gold-comment"
            className="text-[11px] uppercase tracking-wide text-ink-muted"
          >
            Justification (facultative)
          </label>
          <textarea
            id="gold-comment"
            data-testid="gold-comment"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Pourquoi ce thème plutôt qu'un autre ?"
            className="w-full resize-y rounded-md border border-line bg-panel px-2 py-1 text-[13px] text-ink outline-none placeholder:text-ink-muted focus:border-accent"
          />
        </div>
      ) : (
        <button
          type="button"
          data-testid="gold-comment-open"
          onClick={() => setCommentOpen(true)}
          className="inline-flex w-fit items-center gap-1 text-[12px] text-ink-muted hover:text-ink"
        >
          <MessageSquarePlus size={13} aria-hidden />
          {comment ? "Modifier la justification" : "Ajouter une justification"}
        </button>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          data-testid="gold-decision-submit"
          disabled={disabled || !primary}
          loading={pending}
          icon={<Check size={14} />}
          onClick={() => onSubmit(primary, secondaries, comment)}
          title={primary ? "Enregistrer cette décision" : "Choisissez d'abord un thème principal"}
        >
          {sentence.decided ? "Remplacer la décision" : "Enregistrer la décision"}
        </Button>
        {selection.length > 0 && (
          <button
            type="button"
            data-testid="gold-decision-clear"
            onClick={() => setSelection([])}
            className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-danger"
          >
            <X size={12} aria-hidden /> Vider
          </button>
        )}
      </div>
    </div>
  );
}
