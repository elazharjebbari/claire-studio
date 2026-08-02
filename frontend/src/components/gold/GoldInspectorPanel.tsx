"use client";

/**
 * Inspecteur GOLD (panneau droit) — pour la phrase sélectionnée : ce que CHAQUE annotateur
 * et CHAQUE LLM ont proposé, la proposition du moteur (classe d'accord, risque, confiance,
 * signal humain≠LLM), et les contrôles de DÉCISION (adopter un candidat / valider). Lecture
 * seule si le verrou n'est pas détenu.
 */

import { useMemo } from "react";
import { Check, Bot, Sparkles } from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import { readableTextColor } from "@/lib/tokens";
import { AGREEMENT_META, RISK_META, AUTO_META } from "@/lib/gold/styling";
import { llmJudgeLabel } from "@/lib/llmJudges";
import type { GoldSentenceRow } from "@/lib/gold/types";

export interface GoldInspectorProps {
  sentence: GoldSentenceRow | null;
  canDecide: boolean;
  pending: boolean;
  onDecide: (index: number, primary: string, secondaries: string[], clientY: number) => void;
}

function candidatePrimaries(s: GoldSentenceRow): string[] {
  // Candidats = propositions des ANNOTATEURS uniquement (la résolution reste entre eux).
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (c: string) => {
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  };
  add(s.proposedPrimary);
  s.annotators.forEach((a) => add(a.primary));
  return out;
}

export function GoldInspectorPanel({ sentence, canDecide, pending, onDecide }: GoldInspectorProps) {
  const candidates = useMemo(() => (sentence ? candidatePrimaries(sentence) : []), [sentence]);

  if (!sentence) {
    return (
      <div className="p-4 text-sm text-ink-muted" data-testid="gold-inspector-empty">
        Sélectionnez une phrase pour arbitrer.
      </div>
    );
  }

  const ag = AGREEMENT_META[sentence.agreementClass];
  const risk = RISK_META[sentence.riskBand];
  const auto = AUTO_META[sentence.autoLevel];

  return (
    <div className="flex flex-col gap-3 p-3" data-testid="gold-inspector">
      <div className="text-[11px] uppercase tracking-wide text-ink-muted">
        Phrase {sentence.index}
      </div>
      <p className="rounded-md bg-reading p-2 text-sm text-ink">{sentence.text}</p>

      {/* Proposition du moteur */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${ag.cls}`}>
          {ag.label}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${risk.cls}`}>
          Risque {risk.label.toLowerCase()}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${auto.cls}`}>
          {sentence.autoLevel !== "manual" && <Sparkles size={11} aria-hidden />} {auto.label}
        </span>
        <span className="rounded-full border border-line bg-panel-muted px-2 py-0.5 font-mono text-[11px] text-ink-muted">
          conf {Math.round(sentence.confidence * 100)}%
        </span>
      </div>

      {/* Votes des annotateurs */}
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wide text-ink-muted">Annotateurs</div>
        <ul className="flex flex-col gap-1" data-testid="gold-annot-votes">
          {sentence.annotators.length === 0 && (
            <li className="text-[12px] text-ink-muted">Aucun annotateur n'a couvert cette phrase.</li>
          )}
          {sentence.annotators.map((a) => (
            <li key={a.voterId} className="flex items-center gap-2 text-[13px]">
              <span
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                style={{ backgroundColor: a.color, color: readableTextColor(a.color) }}
                aria-hidden
              >
                {a.displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 truncate text-ink-muted">{a.displayName}</span>
              <span className="ml-auto font-mono text-ink">{a.primary}</span>
              {a.secondaries.length > 0 && (
                <span className="font-mono text-[11px] text-ink-muted">+{a.secondaries.join(",")}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Votes LLM — RÉFÉRENCE indicative (n'entrent pas dans la décision) */}
      <div>
        <div className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wide text-ink-muted">
          <Bot size={12} aria-hidden /> Modèles · référence (hors décision)
        </div>
        <ul className="flex flex-wrap gap-1" data-testid="gold-llm-votes">
          {sentence.llms.map((l) => (
            <li
              key={l.judge}
              className="inline-flex items-center gap-1 rounded-full border border-info/40 bg-info/10 px-2 py-0.5 text-[11px] text-info"
            >
              {llmJudgeLabel(l.judge)}: <span className="font-mono">{l.primary}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Décision */}
      <div className="mt-1 border-t border-line pt-2">
        <div className="mb-1 text-[11px] uppercase tracking-wide text-ink-muted">
          {sentence.decided ? (sentence.autoResolved ? "Auto-résolu" : "Décidé") : "Décider le gold"}
        </div>
        {sentence.decided && (
          <div className="mb-2 text-[12px] text-ink">
            Gold : <span className="font-mono">{sentence.primary}</span>
            {sentence.secondaries.length > 0 && (
              <span className="font-mono text-ink-muted"> +{sentence.secondaries.join(",")}</span>
            )}
            {!sentence.autoResolved && sentence.decidedByName && (
              <span className="text-ink-muted"> · {sentence.decidedByName}</span>
            )}
          </div>
        )}
        {!canDecide ? (
          <div className="text-[12px] text-ink-muted" data-testid="gold-inspector-readonly">
            Lecture seule (verrou non détenu).
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5" data-testid="gold-decide-candidates">
            {candidates.map((code) => {
              const isGold = sentence.decided && sentence.primary === code;
              return (
                <button
                  key={code}
                  type="button"
                  data-testid={`gold-decide-${code}`}
                  disabled={pending}
                  onClick={(e) =>
                    onDecide(sentence.index, code, sentence.proposedSecondaries, e.clientY)
                  }
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-medium transition-colors disabled:opacity-50 ${
                    isGold
                      ? "border-success/50 bg-success/15 text-success"
                      : "border-line bg-panel text-ink hover:bg-panel-muted"
                  }`}
                >
                  {isGold && <Check size={12} aria-hidden />}
                  <span className="font-mono">{code}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
