"use client";

/**
 * TriageQueueView — vue (présentationnelle) du mode File de triage.
 *
 * Liste les phrases triables (ordonnées par niveau C1→C5 puis index), met en avant la
 * suggestion COURANTE (SuggestionCard), et offre les gestes clavier-first :
 *   Entrée = action primaire · j/↓ suivant · k/↑ précédent · A = accepter tout C1.
 * Pure : items + position + callbacks injectés ; aucune dépendance réseau (testable RTL).
 */

import { useCallback, useEffect } from "react";

import type { TriageLevel, TriageResult } from "@/lib/triage";
import { SuggestionCard } from "./SuggestionCard";

export interface QueueRow {
  index: number; // index de phrase
  result: TriageResult;
}

export interface TriageQueueViewProps {
  items: QueueRow[];
  summary: Record<TriageLevel, number>;
  pos: number; // position courante dans items
  done: Set<number>; // index de phrases déjà traitées
  c1Count: number;
  onPos: (pos: number) => void;
  onAccept: (row: QueueRow) => void;
  onSwap: (row: QueueRow, label: string) => void;
  onRemoveSecondary: (row: QueueRow, label: string) => void;
  onChoose: (row: QueueRow, label: string) => void;
  onUndoOverride: (row: QueueRow) => void;
  onBatchAcceptC1: () => void;
  onClose: () => void;
}

const ORDER: TriageLevel[] = ["C1", "C2", "C3", "C4", "C5"];

export function TriageQueueView(props: TriageQueueViewProps) {
  const { items, summary, pos, done, c1Count, onPos, onAccept, onBatchAcceptC1, onClose } = props;
  const current = items[pos];

  const move = useCallback(
    (delta: number) => onPos(Math.min(items.length - 1, Math.max(0, pos + delta))),
    [items.length, pos, onPos],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") return onClose();
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter" && current && current.result.level !== "C5") { e.preventDefault(); onAccept(current); }
      else if ((e.key === "a" || e.key === "A") && c1Count > 0) { e.preventDefault(); onBatchAcceptC1(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, move, onAccept, onBatchAcceptC1, onClose, c1Count]);

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
        <button type="button" data-testid="triage-close" aria-label="Fermer la file" onClick={onClose}
          className="rounded p-1 text-ink-muted hover:bg-panel-muted">✕</button>
      </header>

      {/* Résumé par niveau + lot C1 */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2 text-[11px]">
        {ORDER.map((lvl) => (
          <span key={lvl} data-testid={`triage-count-${lvl}`} className="rounded bg-panel-muted px-1.5 py-0.5 text-ink-muted">
            {lvl} {summary[lvl]}
          </span>
        ))}
        {c1Count > 0 && (
          <button type="button" data-testid="triage-batch-c1" onClick={onBatchAcceptC1}
            className="ml-auto rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-fg hover:brightness-110">
            ✓ Accepter tout C1 ({c1Count})
          </button>
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
              onAccept={() => onAccept(current)}
              onSwap={(l) => props.onSwap(current, l)}
              onRemoveSecondary={(l) => props.onRemoveSecondary(current, l)}
              onChoose={(l) => props.onChoose(current, l)}
              onUndoOverride={() => props.onUndoOverride(current)}
            />
            {done.has(current.index) && (
              <p data-testid="triage-done" className="mt-2 text-[11px] text-emerald-400">✓ traité</p>
            )}
          </>
        ) : null}
      </div>
    </aside>
  );
}
