"use client";

/**
 * SuggestionCard — carte de suggestion de triage (présentationnelle, pure).
 *
 * Affiche, pour une phrase, le NIVEAU (C1–C5), puis l'explication déterministe du moteur
 * en trois temps : CONTEXTE (votes des juges), DÉCISION (set recommandé + frontière),
 * LOGIQUE (la règle qui s'applique). Une action primaire (Accepter / Confirmer / Valider)
 * + des affordances par niveau (permuter, retirer 2ⁿᵈ, choisir un candidat, annuler l'override).
 * Aucune logique métier ici : tout vient du `TriageResult` (moteur) et des callbacks.
 */

import { getThemeToken, readableTextColor } from "@/lib/tokens";
import type { TriageResult } from "@/lib/triage";
import { TRIAGE_LEVEL_META as LEVEL_META } from "@/lib/triage";

function ThemeChip({ label, role }: { label: string; role: "primary" | "secondary" }) {
  const color = getThemeToken(label).color;
  if (role === "primary") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold"
        style={{ backgroundColor: color, color: readableTextColor(color) }}
        data-testid={`chip-primary-${label}`}
      >
        ✓ {label}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium"
      style={{ borderColor: color, color }}
      data-testid={`chip-secondary-${label}`}
    >
      ◻ {label}
    </span>
  );
}

export interface SuggestionCardProps {
  result: TriageResult;
  onAccept: () => void;
  onSwap?: (label: string) => void;
  onRemoveSecondary?: (label: string) => void;
  onChoose?: (label: string) => void;
  onUndoOverride?: () => void;
}

export function SuggestionCard({
  result,
  onAccept,
  onSwap,
  onRemoveSecondary,
  onChoose,
  onUndoOverride,
}: SuggestionCardProps) {
  const meta = LEVEL_META[result.level];
  const primary = result.labels.find((l) => l.role === "primary");
  const secondary = result.labels.find((l) => l.role === "secondary");
  const acceptText =
    result.level === "C1" ? "Accepter"
    : result.level === "C2" ? "Confirmer"
    : result.level === "C3" ? "Valider le set"
    : result.level === "C4" ? "Garder majorité"
    : "Choisir";

  return (
    <section
      data-testid="suggestion-card"
      data-level={result.level}
      aria-label={`Suggestion, niveau ${result.level} ${meta.label}`}
      className="rounded-lg border border-line bg-panel p-3 text-sm"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          data-testid="triage-badge"
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
        >
          <span aria-hidden>{meta.icon}</span> {result.level} · {meta.label}
        </span>
        {result.level !== "C5" && (
          <button
            type="button"
            data-testid="suggestion-accept"
            onClick={onAccept}
            className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-fg hover:brightness-110"
          >
            {acceptText}
          </button>
        )}
      </div>

      {/* Décision : set recommandé (ou candidats en C5/open) */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        {result.labelMode === "open" ? (
          result.candidates.map((c) => (
            <button
              key={c}
              type="button"
              data-testid={`suggestion-choose-${c}`}
              onClick={() => onChoose?.(c)}
              className="rounded border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink hover:bg-panel-muted"
            >
              {c}
            </button>
          ))
        ) : (
          <>
            {primary && <ThemeChip label={primary.label} role="primary" />}
            {secondary && <ThemeChip label={secondary.label} role="secondary" />}
            <span className="text-[10px] text-ink-muted">
              · frontière {result.boundary.type === "hard" ? "dure ▮" : "molle ┄"} ({result.boundary.support})
            </span>
          </>
        )}
      </div>

      {/* Logique + contexte (le « pourquoi », déterministe) */}
      <p data-testid="suggestion-logic" className="text-[11px] text-ink-muted">{result.explanation.logic}</p>
      <p data-testid="suggestion-context" className="mt-0.5 text-[10px] text-ink-muted/80">{result.explanation.context}</p>

      {/* Affordances par niveau */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {result.override && (
          <button type="button" data-testid="suggestion-undo-override" onClick={onUndoOverride}
            className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-panel-muted">
            ↺ Annuler l'override ({result.override.from})
          </button>
        )}
        {result.level === "C3" && secondary && (
          <>
            <button type="button" data-testid="suggestion-swap" onClick={() => onSwap?.(secondary.label)}
              className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-panel-muted">
              ⇅ Permuter
            </button>
            <button type="button" data-testid="suggestion-remove-secondary" onClick={() => onRemoveSecondary?.(secondary.label)}
              className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-panel-muted">
              − Retirer 2ⁿᵈ
            </button>
          </>
        )}
        {result.level === "C4" &&
          result.candidates
            .filter((c) => c !== primary?.label)
            .map((c) => (
              <button key={c} type="button" data-testid={`suggestion-choose-${c}`} onClick={() => onChoose?.(c)}
                className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-panel-muted">
                → Choisir {c}
              </button>
            ))}
      </div>
    </section>
  );
}
