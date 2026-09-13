"use client";

/**
 * Inspecteur GOLD (panneau droit) — pour la phrase sélectionnée : ce que CHAQUE annotateur
 * et CHAQUE LLM ont proposé, la proposition du moteur (classe d'accord, risque, confiance),
 * et les contrôles de DÉCISION. Lecture seule si le verrou n'est pas détenu.
 *
 * Deux chemins de décision, volontairement distincts :
 *  - VOIE RAPIDE : adopter l'un des thèmes votés, numéroté (raccourcis 1..9), ordre stable ;
 *  - VOIE COMPLÈTE (`GoldDecisionComposer`) : n'importe quel thème du schéma, secondaires
 *    éditables et justification — indispensable sur les égalités 1-1-1, où aucun des trois
 *    votes ne fait consensus et où les trois annotateurs peuvent tous s'être trompés.
 */

import { useMemo, useState } from "react";
import { Check, Bot, Sparkles, Scale, UserX } from "lucide-react";
import { Disclosure } from "@/components/ui/Disclosure";
import { GoldDecisionComposer } from "./GoldDecisionComposer";
import { getThemeToken, readableTextColor } from "@/lib/tokens";
import { AGREEMENT_META, RISK_META, AUTO_META } from "@/lib/gold/styling";
import { llmJudgeLabel } from "@/lib/llmJudges";
import type { GoldSentenceRow } from "@/lib/gold/types";
import type { DisplayLang } from "@/lib/prefs/schema";

export interface GoldInspectorProps {
  sentence: GoldSentenceRow | null;
  /** VO / bilingue / FR — même réglage que le panneau de lecture. */
  displayLang?: DisplayLang;
  canDecide: boolean;
  pending: boolean;
  onDecide: (
    index: number,
    primary: string,
    secondaries: string[],
    clientY: number,
    comment?: string,
  ) => void;
}

export function candidatePrimaries(s: GoldSentenceRow): string[] {
  // Candidats = propositions des ANNOTATEURS uniquement (la résolution reste entre eux).
  // Ordre ALPHABÉTIQUE et non l'ordre des votes : les raccourcis 1..9 doivent désigner la
  // même chose tant que les candidats ne changent pas, et l'ordre des votes varie d'une
  // phrase à l'autre (une cible qui se déplace fait commettre des erreurs en rafale).
  const codes = new Set<string>();
  for (const a of s.annotators) {
    if (a.primary) codes.add(a.primary);
  }
  if (s.proposedPrimary) codes.add(s.proposedPrimary);
  return [...codes].sort();
}

export function GoldInspectorPanel({
  sentence,
  displayLang = "orig",
  canDecide,
  pending,
  onDecide,
}: GoldInspectorProps) {
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
      <div className="rounded-md bg-reading p-2 text-sm text-ink">
        <p>{displayLang === "fr" && sentence.textFr ? sentence.textFr : sentence.text}</p>
        {/* Bilingue : la traduction sous la VO — l'arbitre tranche sur le texte qui fait
            foi (l'anglais) tout en s'appuyant sur le français pour la compréhension. */}
        {displayLang === "both" && sentence.textFr && (
          <p data-testid="gold-inspector-translation" className="mt-1 italic text-ink-muted">
            {sentence.textFr}
          </p>
        )}
      </div>

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
            <li className="flex items-center gap-1.5 text-[12px] text-warning" data-testid="gold-uncovered">
              <UserX size={13} aria-hidden /> Aucun annotateur n'a couvert cette phrase — composez
              la décision ci-dessous.
            </li>
          )}
          {sentence.annotators.length === 1 && (
            <li className="flex items-center gap-1.5 text-[12px] text-warning" data-testid="gold-solitary">
              <UserX size={13} aria-hidden /> Un seul annotateur : aucun accord constatable.
            </li>
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
          <div className="flex flex-col gap-2">
            {/* Avertissement d'ÉGALITÉ : sans lui, la « proposition » du moteur ressemble
                à un consensus alors que c'est un départage alphabétique. */}
            {sentence.tie && (
              <p
                data-testid="gold-tie-warning"
                className="flex items-start gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-[12px] text-danger"
              >
                <Scale size={13} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  Aucun consensus : les annotateurs sont à égalité. La proposition affichée
                  n'est qu'un départage alphabétique — <strong>choisissez explicitement</strong>.
                </span>
              </p>
            )}

            {/* Voie rapide : adopter un thème voté (numéroté = raccourcis clavier 1..9). */}
            <div className="flex flex-wrap gap-1.5" data-testid="gold-decide-candidates">
              {candidates.map((code, i) => {
                const isGold = sentence.decided && sentence.primary === code;
                const token = getThemeToken(code);
                return (
                  <button
                    key={code}
                    type="button"
                    data-testid={`gold-decide-${code}`}
                    disabled={pending}
                    title={`${token.label} — raccourci ${i + 1}`}
                    onClick={(e) =>
                      onDecide(sentence.index, code, sentence.proposedSecondaries, e.clientY)
                    }
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] font-medium transition-colors disabled:opacity-50 ${
                      isGold
                        ? "border-success/50 bg-success/15 text-success"
                        : "border-line bg-panel text-ink hover:bg-panel-muted"
                    }`}
                  >
                    {isGold && <Check size={12} aria-hidden />}
                    {i < 9 && (
                      <kbd
                        aria-hidden
                        className="rounded border border-line bg-panel-muted px-1 font-mono text-[10px] text-ink-muted"
                      >
                        {i + 1}
                      </kbd>
                    )}
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: token.color }}
                      aria-hidden
                    />
                    <span>{token.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Voie complète : tout le schéma + secondaires + justification. Repliée par
                défaut, ouverte d'office quand aucun candidat n'existe (phrase non couverte)
                ou quand aucune proposition ne fait consensus. */}
            <Disclosure
              testId="gold-compose"
              icon={<Sparkles size={13} aria-hidden />}
              summary="Composer la décision (autre thème, secondaires, justification)"
              defaultOpen={candidates.length === 0 || sentence.tie === true}
            >
              <GoldDecisionComposer
                sentence={sentence}
                disabled={pending}
                pending={pending}
                onSubmit={(primary, secondaries, comment) =>
                  onDecide(sentence.index, primary, secondaries, 0, comment)
                }
              />
            </Disclosure>
          </div>
        )}
      </div>
    </div>
  );
}
