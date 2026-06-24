"use client";

/**
 * SuggestionCard — carte de suggestion de triage (présentationnelle, pure) REFONDUE
 * (dossier docs/pactiva/dossier-suggestion-card). Du haut vers le bas :
 *   1. en-tête : badge NIVEAU (icône lucide + libellé, teinté) + action primaire nommée ;
 *   2. TEXTE de la phrase (ce qu'on décide) ;
 *   3. « Ce que disent les juges » : récap des votes + jauge d'accord + frontière ;
 *   4. « Décision recommandée » : thèmes en LIBELLÉS (primaire plein, secondaire pointillé) ;
 *   5. « Pourquoi ce niveau » : signification (code-free) + ligne spécifique humanisée ;
 *   6. « Alternatives » : candidats (libellés + support) → choisir (unitaire) / composer un
 *      multi / permuter / retirer 2ⁿᵈ / annuler l'override.
 * Aucune logique métier : tout vient du `TriageResult` (moteur) ; aucun code de thème brut.
 */

import { useState } from "react";
import {
  ShieldCheck, Check, Layers, AlertTriangle, Scale,
  Users, Sparkles, Info, Shuffle, ArrowRight, Repeat, Minus, Undo2,
} from "lucide-react";
import { getThemeToken, readableTextColor } from "@/lib/tokens";
import { llmJudgeLabel } from "@/lib/llmJudges";
import type { TriageLevel, TriageResult } from "@/lib/triage";
import { TRIAGE_LEVEL_META as LEVEL_META } from "@/lib/triage";

const LEVEL_ICON: Record<TriageLevel, typeof Check> = {
  C1: ShieldCheck,
  C2: Check,
  C3: Layers,
  C4: AlertTriangle,
  C5: Scale,
};

const themeLabel = (code: string) => getThemeToken(code).label;

function ThemeChip({ label, role }: { label: string; role: "primary" | "secondary" }) {
  const color = getThemeToken(label).color;
  if (role === "primary") {
    return (
      <span
        data-testid={`chip-primary-${label}`}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
        style={{ backgroundColor: color, color: readableTextColor(color) }}
      >
        {themeLabel(label)}
      </span>
    );
  }
  return (
    <span
      data-testid={`chip-secondary-${label}`}
      className="inline-flex items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-[11px] font-medium"
      style={{ borderColor: color, color }}
    >
      {themeLabel(label)}
    </span>
  );
}

function Section({
  icon: Icon,
  title,
  children,
  testid,
}: {
  icon: typeof Info;
  title: string;
  children: React.ReactNode;
  testid?: string;
}) {
  return (
    <div className="border-t border-line/60 pt-2" data-testid={testid}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        <Icon size={12} aria-hidden /> {title}
      </div>
      {children}
    </div>
  );
}

export interface SuggestionCardProps {
  result: TriageResult;
  /** Texte de la phrase triée (contexte de décision). */
  sentenceText?: string;
  /** Votes par juge (judgeId → code thème) — pour expliquer « pourquoi ». */
  votes?: Record<string, string>;
  onAccept: () => void;
  onSwap?: (label: string) => void;
  onRemoveSecondary?: (label: string) => void;
  onChoose?: (label: string) => void;
  /** Composer un multi-label (primaire + secondaire) depuis les candidats. */
  onMulti?: (primary: string, secondary: string) => void;
  onUndoOverride?: () => void;
}

export function SuggestionCard({
  result,
  sentenceText,
  votes = {},
  onAccept,
  onSwap,
  onRemoveSecondary,
  onChoose,
  onMulti,
  onUndoOverride,
}: SuggestionCardProps) {
  const meta = LEVEL_META[result.level];
  const LevelIcon = LEVEL_ICON[result.level];
  const primary = result.labels.find((l) => l.role === "primary");
  const secondary = result.labels.find((l) => l.role === "secondary");
  const [showFull, setShowFull] = useState(false);

  const acceptText =
    result.level === "C1" ? "Accepter"
    : result.level === "C2" ? "Confirmer"
    : result.level === "C3" ? "Valider le set"
    : result.level === "C4" ? "Garder majorité"
    : "Choisir";

  // Récap des votes : regroupe les juges par thème voté (du + soutenu au -).
  const voteEntries = Object.entries(votes);
  const byTheme = new Map<string, string[]>();
  for (const [judge, code] of voteEntries) {
    const arr = byTheme.get(code);
    if (arr) arr.push(judge);
    else byTheme.set(code, [judge]);
  }
  const voteGroups = [...byTheme.entries()].sort((a, b) => b[1].length - a[1].length);
  const total = voteEntries.length;
  const topCount = voteGroups[0]?.[1].length ?? 0;

  // Ligne SPÉCIFIQUE humanisée (sans code brut) selon le type de désaccord.
  const specific = (() => {
    if (result.override) {
      return `Override anti-refuge : « ${themeLabel(result.override.from)} » (refuge) écarté au profit de « ${themeLabel(result.override.to)} ».`;
    }
    if (result.labelMode === "multi" && primary && secondary) {
      return `Couple lié : « ${themeLabel(primary.label)} » + « ${themeLabel(secondary.label)} » — chevauchement juridique réel.`;
    }
    return null;
  })();

  // Candidats alternatifs (hors thème déjà primaire).
  const altCandidates = result.candidates.filter((c) => c !== primary?.label);
  const truncated = sentenceText && sentenceText.length > 160;
  const shownText = truncated && !showFull ? `${sentenceText!.slice(0, 160)}…` : sentenceText;

  return (
    <section
      data-testid="suggestion-card"
      data-level={result.level}
      aria-label={`Suggestion, niveau ${result.level} ${meta.label}`}
      className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3 text-sm"
      style={{ boxShadow: `inset 3px 0 0 ${meta.color}` }}
    >
      {/* 1. En-tête : niveau + action primaire */}
      <div className="flex items-center justify-between gap-2">
        <span
          data-testid="triage-badge"
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
        >
          <LevelIcon size={12} aria-hidden /> {result.level} · {meta.label}
        </span>
        {result.level !== "C5" && (
          <button
            type="button"
            data-testid="suggestion-accept"
            onClick={onAccept}
            className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-fg hover:brightness-110"
          >
            <Check size={13} aria-hidden /> {acceptText}
          </button>
        )}
      </div>

      {/* 2. Texte de la phrase (ce qu'on décide) */}
      {sentenceText && (
        <p
          data-testid="suggestion-sentence"
          className="rounded border-l-2 border-line bg-panel-muted/40 px-2 py-1 text-[13px] italic leading-snug text-ink"
        >
          « {shownText} »
          {truncated && (
            <button
              type="button"
              onClick={() => setShowFull((v) => !v)}
              className="ml-1 not-italic text-accent hover:underline"
            >
              {showFull ? "réduire" : "voir plus"}
            </button>
          )}
        </p>
      )}

      {/* 3. Ce que disent les juges : votes + jauge d'accord + frontière */}
      {total > 0 && (
        <Section icon={Users} title="Ce que disent les juges" testid="suggestion-votes">
          <div className="flex flex-col gap-1">
            {voteGroups.map(([code, judges]) => (
              <div key={code} className="flex items-center gap-1.5 text-[11px]">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: getThemeToken(code).color }}
                />
                <span className="text-ink">{themeLabel(code)}</span>
                <span className="text-ink-muted">
                  ← {judges.map((j) => llmJudgeLabel(j)).join(", ")}
                </span>
              </div>
            ))}
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-muted">
              <span aria-hidden className="inline-flex gap-0.5">
                {Array.from({ length: total }).map((_, i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: i < topCount ? meta.color : "currentColor",
                      opacity: i < topCount ? 1 : 0.25,
                    }}
                  />
                ))}
              </span>
              accord {topCount}/{total} · frontière {result.boundary.type === "hard" ? "dure" : "molle"} ({result.boundary.support})
            </div>
          </div>
        </Section>
      )}

      {/* 4. Décision recommandée (libellés) */}
      <Section icon={Sparkles} title="Décision recommandée" testid="suggestion-decision">
        {result.labelMode === "open" ? (
          <p className="text-[11px] text-ink-muted">
            Aucune présélection — choisissez ci-dessous.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {primary && <ThemeChip label={primary.label} role="primary" />}
            {secondary && <ThemeChip label={secondary.label} role="secondary" />}
          </div>
        )}
      </Section>

      {/* 5. Pourquoi ce niveau : signification (code-free) + ligne spécifique */}
      <Section icon={Info} title="Pourquoi ce niveau" testid="suggestion-why">
        <p data-testid="suggestion-logic" className="text-[12px] leading-snug text-ink">
          {meta.meaning}
        </p>
        {specific && (
          <p data-testid="suggestion-context" className="mt-0.5 text-[11px] leading-snug text-ink-muted">
            {specific}
          </p>
        )}
        <p className="mt-0.5 text-[10px] text-ink-muted/80">{meta.action}</p>
      </Section>

      {/* 6. Alternatives (unitaires / multiple) */}
      {(altCandidates.length > 0 || (result.level === "C3" && secondary) || result.override) && (
        <Section icon={Shuffle} title="Alternatives" testid="suggestion-alternatives">
          <div className="flex flex-wrap gap-1.5">
            {result.override && (
              <button type="button" data-testid="suggestion-undo-override" onClick={onUndoOverride}
                className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-panel-muted">
                <Undo2 size={11} aria-hidden /> Garder « {themeLabel(result.override.from)} »
              </button>
            )}
            {result.level === "C3" && secondary && (
              <>
                <button type="button" data-testid="suggestion-swap" onClick={() => onSwap?.(secondary.label)}
                  className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-panel-muted">
                  <Repeat size={11} aria-hidden /> Permuter principal/secondaire
                </button>
                <button type="button" data-testid="suggestion-remove-secondary" onClick={() => onRemoveSecondary?.(secondary.label)}
                  className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-panel-muted">
                  <Minus size={11} aria-hidden /> Garder « {themeLabel(primary!.label)} » seul
                </button>
              </>
            )}
            {/* Choisir un candidat (annotation UNITAIRE). */}
            {altCandidates.map((c) => (
              <button key={c} type="button" data-testid={`suggestion-choose-${c}`} onClick={() => onChoose?.(c)}
                className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[11px] text-ink hover:bg-panel-muted">
                <ArrowRight size={11} aria-hidden /> {themeLabel(c)}
              </button>
            ))}
            {/* Composer un MULTI à partir des 2 premiers candidats (arbitrage C5). */}
            {result.level === "C5" && result.candidates.length >= 2 && onMulti && (
              <button type="button" data-testid="suggestion-make-multi"
                onClick={() => onMulti(result.candidates[0]!, result.candidates[1]!)}
                className="inline-flex items-center gap-1 rounded border border-dashed border-line px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-panel-muted">
                <Layers size={11} aria-hidden /> Multi : {themeLabel(result.candidates[0]!)} + {themeLabel(result.candidates[1]!)}
              </button>
            )}
          </div>
        </Section>
      )}
    </section>
  );
}
