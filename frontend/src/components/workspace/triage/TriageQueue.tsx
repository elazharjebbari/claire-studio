"use client";

/**
 * TriageQueue — conteneur du mode File de triage.
 *
 * Branche le moteur réactif (`useTriage`) sur les données live des juges et persiste
 * chaque décision via l'API (addClause multi-label / batch C1), puis avance. Le moteur,
 * le backend multi-label et l'écriture sont déjà livrés ; ce composant orchestre l'UX.
 */

import { useMemo, useState } from "react";

import { useAddClause, useBatchAcceptClauses } from "@/lib/api/hooks";
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

export function TriageQueue({ annotationId, documentId, projectSlug, onClose }: TriageQueueProps) {
  const llmVersion = useWorkspaceStore((s) => s.llmVersion);
  const triage = useTriage(documentId, projectSlug, llmVersion);
  const addClause = useAddClause(annotationId);
  const batch = useBatchAcceptClauses(annotationId);
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

  const markDone = (idx: number) =>
    setDone((d) => {
      const n = new Set(d);
      n.add(idx);
      return n;
    });

  const persist = (row: QueueRow, themes: ThemeTag[]) => {
    const primary = themes.find((t) => t.role === "primary")?.label ?? themes[0]?.label ?? "";
    addClause.mutate(
      {
        anchorIndex: row.index,
        theme: primary,
        themes,
        boundary: row.result.boundary,
        triageLevel: row.result.level,
        validated: true,
        clientOpId: `triage-${row.index}`,
      },
      {
        onSuccess: () => {
          markDone(row.index);
          setPos((p) => Math.min(items.length - 1, p + 1));
        },
      },
    );
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

  const onBatchAcceptC1 = () => {
    const c1 = items.filter((r) => r.result.level === "C1" && !done.has(r.index));
    if (!c1.length) return;
    batch.mutate(
      c1.map((r) => ({
        anchorIndex: r.index,
        theme: labelsOf(r.result)[0]!.label,
        themes: labelsOf(r.result),
        boundary: r.result.boundary,
        triageLevel: "C1",
        clientOpId: `triage-${r.index}`,
      })),
      {
        onSuccess: () =>
          setDone((d) => {
            const n = new Set(d);
            c1.forEach((r) => n.add(r.index));
            return n;
          }),
      },
    );
  };

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

  return (
    <TriageQueueView
      items={items}
      summary={triage.summary}
      pos={Math.min(pos, Math.max(0, items.length - 1))}
      done={done}
      c1Count={c1Count}
      onPos={setPos}
      onAccept={(row) => persist(row, labelsOf(row.result))}
      onSwap={onSwap}
      onRemoveSecondary={onRemoveSecondary}
      onChoose={onChoose}
      onUndoOverride={onUndoOverride}
      onBatchAcceptC1={onBatchAcceptC1}
      onClose={onClose}
    />
  );
}
