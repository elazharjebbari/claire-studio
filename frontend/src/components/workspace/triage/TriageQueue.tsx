"use client";

/**
 * TriageQueue — conteneur du mode File de triage.
 *
 * Branche le moteur réactif (`useTriage`) sur les données live des juges et applique
 * chaque décision au STORE (`applyTriageDecision`/`applyTriageBatch`) — comme toute autre
 * édition. L'autosave persiste ensuite (create/update multi-label) : l'UI (rail, badge,
 * plan, barres, inspecteur) se met donc à jour INSTANTANÉMENT, sans re-init destructif ni
 * race. La file est aussi sensible à la SÉLECTION du document (simple : focus ↔ carte
 * courante ; multiple : « accepter la sélection »).
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { useTriage } from "@/lib/triage/useTriage";
import type { TriageLevel, TriageResult } from "@/lib/triage";
import type { ThemeTag } from "@/types/contract";
import { useWorkspaceStore } from "@/store/workspace";
import { TriageQueueView, type QueueRow } from "./TriageQueueView";

const ORDER: Record<TriageLevel, number> = { C1: 0, C2: 1, C3: 2, C4: 3, C5: 4 };

function labelsOf(r: TriageResult): ThemeTag[] {
  return r.labels.map((l) => ({ label: l.label, role: l.role, support: l.support }));
}

export interface TriageQueueProps {
  annotationId: string;
  documentId: string;
  projectSlug: string;
  onClose: () => void;
}

export function TriageQueue({ documentId, projectSlug, onClose }: TriageQueueProps) {
  const llmVersion = useWorkspaceStore((s) => s.llmVersion);
  const applyTriageDecision = useWorkspaceStore((s) => s.applyTriageDecision);
  const applyTriageBatch = useWorkspaceStore((s) => s.applyTriageBatch);
  const focusedSentence = useWorkspaceStore((s) => s.focusedSentence);
  const focusSentence = useWorkspaceStore((s) => s.focusSentence);
  const selectedSentences = useWorkspaceStore((s) => s.selectedSentences);

  const triage = useTriage(documentId, projectSlug, llmVersion);
  const [pos, setPos] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());

  const items: QueueRow[] = useMemo(
    () =>
      triage.items
        .filter((it): it is { index: number; result: TriageResult } => it.result != null)
        .map((it) => ({ index: it.index, result: it.result }))
        .sort((a, b) => ORDER[a.result.level] - ORDER[b.result.level] || a.index - b.index),
    [triage.items],
  );

  // Index inverse n° de phrase → rang dans la file (pour la synchro document → file).
  const posByIndex = useMemo(() => {
    const m = new Map<number, number>();
    items.forEach((r, i) => m.set(r.index, i));
    return m;
  }, [items]);

  const selectedSet = useMemo(() => new Set(selectedSentences), [selectedSentences]);

  const markDone = (idx: number) =>
    setDone((d) => {
      const n = new Set(d);
      n.add(idx);
      return n;
    });

  const markManyDone = (idxs: number[]) =>
    setDone((d) => {
      const n = new Set(d);
      idxs.forEach((i) => n.add(i));
      return n;
    });

  // Navigation explicite : positionne la file ET focalise la phrase dans le document
  // (DocumentPanel scrolle vers `focused`). `lastPushedFocus` marque NOTRE push pour que
  // l'effet document→file ne le renvoie pas (anti-boucle).
  const lastPushedFocus = useRef<number | null>(null);
  const goToPos = (p: number) => {
    const clamped = Math.min(Math.max(0, p), Math.max(0, items.length - 1));
    setPos(clamped);
    const idx = items[clamped]?.index;
    if (idx != null && idx !== focusedSentence) {
      lastPushedFocus.current = idx;
      focusSentence(idx);
    }
  };

  const persist = (row: QueueRow, themes: ThemeTag[]) => {
    applyTriageDecision({
      anchorIndex: row.index,
      themes,
      boundary: row.result.boundary,
      triageLevel: row.result.level,
    });
    markDone(row.index);
    goToPos(pos + 1);
  };

  const onSwap = (row: QueueRow, secondary: string) => {
    const swapped: ThemeTag[] = labelsOf(row.result).map((l) => ({
      ...l,
      role: l.label === secondary ? "primary" : l.role === "primary" ? "secondary" : l.role,
    }));
    persist(row, swapped);
  };

  const onRemoveSecondary = (row: QueueRow) => {
    const p = row.result.labels.find((l) => l.role === "primary");
    if (p) persist(row, [{ label: p.label, role: "primary", support: p.support }]);
  };

  const onChoose = (row: QueueRow, label: string) =>
    persist(row, [{ label, role: "primary", support: 0 }]);

  const onUndoOverride = (row: QueueRow) => {
    const from = row.result.override?.from; // accepter le refuge d'origine écarté
    if (from) persist(row, [{ label: from, role: "primary", support: 0 }]);
  };

  // Lot : C1 (or) ou la SÉLECTION de l'annotateur. Jamais C5 (arbitrage, non auto-acceptable).
  const acceptBatch = (rows: QueueRow[]) => {
    const todo = rows.filter((r) => !done.has(r.index) && r.result.level !== "C5");
    if (!todo.length) return;
    applyTriageBatch(
      todo.map((r) => ({
        anchorIndex: r.index,
        themes: labelsOf(r.result),
        boundary: r.result.boundary,
        triageLevel: r.result.level,
      })),
    );
    markManyDone(todo.map((r) => r.index));
  };

  const onBatchAcceptC1 = () => acceptBatch(items.filter((r) => r.result.level === "C1"));
  const onBatchAcceptSelection = () =>
    acceptBatch(items.filter((r) => selectedSet.has(r.index)));

  // ── Synchro SIMPLE : document → file. Quand l'annotateur clique/focalise une phrase
  // dans le document, la file se positionne sur la carte correspondante. On ignore les
  // changements de focus que la file a elle-même provoqués (lastPushedFocus) → anti-boucle.
  useEffect(() => {
    if (focusedSentence === lastPushedFocus.current) return;
    const p = posByIndex.get(focusedSentence);
    if (p != null && p !== pos) setPos(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedSentence, posByIndex]);

  if (!triage.ready) {
    return (
      <aside data-testid="triage-queue" className="flex h-full w-96 shrink-0 flex-col border-l border-line bg-elevated p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink">🧮 File de triage</span>
          <button type="button" data-testid="triage-close" onClick={onClose} className="rounded p-1 text-ink-muted hover:bg-panel-muted">✕</button>
        </div>
        <p data-testid="triage-not-ready" className="mt-4 text-sm text-ink-muted">
          Pré-annotations insuffisantes pour le triage (≥ 2 juges requis).
        </p>
      </aside>
    );
  }

  const c1Count = items.filter((r) => r.result.level === "C1" && !done.has(r.index)).length;
  const selectedCount = items.filter(
    (r) => selectedSet.has(r.index) && !done.has(r.index) && r.result.level !== "C5",
  ).length;

  return (
    <TriageQueueView
      items={items}
      summary={triage.summary}
      pos={Math.min(pos, Math.max(0, items.length - 1))}
      done={done}
      c1Count={c1Count}
      selectedCount={selectedCount}
      onPos={goToPos}
      onAccept={(row) => persist(row, labelsOf(row.result))}
      onSwap={onSwap}
      onRemoveSecondary={onRemoveSecondary}
      onChoose={onChoose}
      onUndoOverride={onUndoOverride}
      onBatchAcceptC1={onBatchAcceptC1}
      onBatchAcceptSelection={onBatchAcceptSelection}
      onClose={onClose}
    />
  );
}
