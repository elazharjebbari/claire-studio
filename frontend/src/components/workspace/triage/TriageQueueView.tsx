"use client";

/**
 * TriageQueueView — vue (présentationnelle) du mode File de triage.
 *
 * Liste les phrases triables (ordonnées par niveau C1→C5 puis index), met en avant la
 * suggestion COURANTE (SuggestionCard), et offre les gestes clavier-first :
 *   Entrée = action primaire · j/↓ suivant · k/↑ précédent · A = accepter tout C1 ·
 *   S = accepter la sélection de phrases du document · ? = ouvrir l'aide.
 * Compteurs colorés par niveau (code couleur partagé), LÉGENDE C1–C5 repliable en pied et
 * MODALE d'aide. Pure : items + position + callbacks injectés ; aucune dépendance réseau.
 */

import { useCallback, useEffect, useState } from "react";

import type { TriageLevel, TriageResult } from "@/lib/triage";
import { TRIAGE_LEVEL_META, TRIAGE_LEVELS_ORDER } from "@/lib/triage";
import { SuggestionCard } from "./SuggestionCard";
import { TriageHelpModal } from "./TriageHelpModal";

export interface QueueRow {
  index: number; // index de phrase
  result: TriageResult;
  /** Votes par juge (judgeId → code thème) — pour expliquer « pourquoi ». */
  votes: Record<string, string>;
  /** Texte original de la phrase (contexte de décision). */
  text: string;
}

export interface TriageQueueViewProps {
  items: QueueRow[];
  summary: Record<TriageLevel, number>;
  pos: number; // position courante dans items
  done: Set<number>; // index de phrases déjà traitées
  c1Count: number;
  /** Nb de phrases SÉLECTIONNÉES dans le document, triables et non traitées (hors C5). */
  selectedCount: number;
  onPos: (pos: number) => void;
  onAccept: (row: QueueRow) => void;
  onSwap: (row: QueueRow, label: string) => void;
  onRemoveSecondary: (row: QueueRow, label: string) => void;
  onChoose: (row: QueueRow, label: string) => void;
  onMulti: (row: QueueRow, primary: string, secondary: string) => void;
  onUndoOverride: (row: QueueRow) => void;
  onBatchAcceptC1: () => void;
  onBatchAcceptSelection: () => void;
  onClose: () => void;
}

export function TriageQueueView(props: TriageQueueViewProps) {
  const { items, summary, pos, done, c1Count, selectedCount, onPos, onAccept,
    onBatchAcceptC1, onBatchAcceptSelection, onClose } = props;
  const current = items[pos];

  const [helpOpen, setHelpOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const move = useCallback(
    (delta: number) => onPos(Math.min(items.length - 1, Math.max(0, pos + delta))),
    [items.length, pos, onPos],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "?") { e.preventDefault(); setHelpOpen(true); return; }
      if (helpOpen) return; // la modale gère son propre clavier (Échap)
      if (e.key === "Escape") return onClose();
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter" && current && current.result.level !== "C5") { e.preventDefault(); onAccept(current); }
      else if ((e.key === "a" || e.key === "A") && c1Count > 0) { e.preventDefault(); onBatchAcceptC1(); }
      else if ((e.key === "s" || e.key === "S") && selectedCount > 0) { e.preventDefault(); onBatchAcceptSelection(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, move, onAccept, onBatchAcceptC1, onBatchAcceptSelection, onClose, c1Count, selectedCount, helpOpen]);

  return (
    <aside
      data-testid="triage-queue"
      aria-label="File de triage"
      className="flex h-full w-96 shrink-0 flex-col border-l border-line bg-elevated"
    >
      <header className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <span aria-hidden>🧮</span> File de triage
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" data-testid="triage-help-open" aria-label="Comprendre la file de triage"
            title="Comprendre le fonctionnement (?)" onClick={() => setHelpOpen(true)}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-[11px] font-semibold text-ink-muted hover:bg-panel-muted hover:text-ink">
            ?
          </button>
          <button type="button" data-testid="triage-close" aria-label="Fermer la file" onClick={onClose}
            className="rounded p-1 text-ink-muted hover:bg-panel-muted">✕</button>
        </div>
      </header>

      {/* Résumé par niveau (code couleur partagé) + lot C1 / sélection */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2 text-[11px]">
        {TRIAGE_LEVELS_ORDER.map((lvl) => {
          const m = TRIAGE_LEVEL_META[lvl];
          return (
            <span
              key={lvl}
              data-testid={`triage-count-${lvl}`}
              title={`${lvl} · ${m.label} — ${m.meaning}`}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium"
              style={{ backgroundColor: `${m.color}1a`, color: m.color }}
            >
              <span aria-hidden className="text-[9px]">{m.icon}</span>
              {lvl} {summary[lvl]}
            </span>
          );
        })}
        {(c1Count > 0 || selectedCount > 0) && (
          <span className="ml-auto flex items-center gap-1.5">
            {selectedCount > 0 && (
              <button type="button" data-testid="triage-batch-selection" onClick={onBatchAcceptSelection}
                title="Accepter les phrases sélectionnées dans le document (S)"
                className="rounded-md border border-accent/60 px-2 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/10">
                ✓ Accepter la sélection ({selectedCount})
              </button>
            )}
            {c1Count > 0 && (
              <button type="button" data-testid="triage-batch-c1" onClick={onBatchAcceptC1}
                className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-fg hover:brightness-110">
                ✓ Accepter tout C1 ({c1Count})
              </button>
            )}
          </span>
        )}
      </div>

      {/* Carte courante */}
      <div className="flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p data-testid="triage-empty" className="text-sm text-ink-muted">
            Rien à trier (pré-annotations insuffisantes ou tout traité).
          </p>
        ) : current ? (
          <>
            <div className="mb-2 flex items-center justify-between text-[11px] text-ink-muted">
              <span data-testid="triage-position">phrase #{current.index} · {pos + 1}/{items.length}</span>
              <span>
                <button type="button" data-testid="triage-prev" onClick={() => move(-1)} className="px-1 hover:text-ink">◂ k</button>
                <button type="button" data-testid="triage-next" onClick={() => move(1)} className="px-1 hover:text-ink">j ▸</button>
              </span>
            </div>
            <SuggestionCard
              result={current.result}
              sentenceText={current.text}
              votes={current.votes}
              onAccept={() => onAccept(current)}
              onSwap={(l) => props.onSwap(current, l)}
              onRemoveSecondary={(l) => props.onRemoveSecondary(current, l)}
              onChoose={(l) => props.onChoose(current, l)}
              onMulti={(p, s) => props.onMulti(current, p, s)}
              onUndoOverride={() => props.onUndoOverride(current)}
            />
            {done.has(current.index) && (
              <p data-testid="triage-done" className="mt-2 text-[11px] text-emerald-400">✓ traité</p>
            )}
          </>
        ) : null}
      </div>

      {/* Légende C1–C5 repliable (pied) — « ce que chacun veut dire » */}
      <div className="border-t border-line px-3 py-1.5 text-[11px]">
        <button
          type="button"
          data-testid="triage-legend-toggle"
          aria-expanded={legendOpen}
          onClick={() => setLegendOpen((v) => !v)}
          className="flex w-full items-center justify-between text-ink-muted hover:text-ink"
        >
          <span>{legendOpen ? "▾" : "▸"} Légende des niveaux (C1–C5)</span>
          <span className="text-[10px] text-ink-muted/70">méthodologie</span>
        </button>
        {legendOpen && (
          <ul data-testid="triage-legend" className="mt-1.5 space-y-1">
            {TRIAGE_LEVELS_ORDER.map((lvl) => {
              const m = TRIAGE_LEVEL_META[lvl];
              return (
                <li key={lvl} className="flex items-start gap-2 leading-snug">
                  <span
                    aria-hidden
                    className="mt-px inline-flex shrink-0 items-center gap-1 rounded px-1 text-[10px] font-semibold"
                    style={{ backgroundColor: `${m.color}1a`, color: m.color }}
                  >
                    {m.icon} {lvl}
                  </span>
                  <span className="text-[10px] text-ink-muted">
                    <span className="font-medium text-ink">{m.label}.</span> {m.meaning}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {helpOpen && <TriageHelpModal onClose={() => setHelpOpen(false)} />}
    </aside>
  );
}
