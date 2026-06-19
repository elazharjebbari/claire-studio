"use client";

/**
 * HistoryPanel (point 2) — journal des actions humaines de la session. Liste
 * chronologique inversée ; chaque entrée affiche l'icône du verbe + le libellé +
 * l'heure. Cliquer une entrée **recentre** le document sur la phrase/clause visée
 * (focus + sélection de la clause si connue). Socle de l'undo/redo (cycle suivant).
 *
 * Panneau repliable, ouvert via un bouton de la barre d'outils.
 */

import { useWorkspaceStore } from "@/store/workspace";

const KIND_ICON: Record<string, string> = {
  "clause.create": "➕",
  "clause.delete": "🗑",
  "clause.retheme": "🏷",
  "clause.set_certainty": "🎚",
  "clause.set_evidenceSpan": "✎",
  "clause.set_rationale": "✎",
  "clause.set_legalNature": "✎",
  "divergence.adopt": "✓",
  "prefill.switch": "📥",
  "prefill.clear": "🧹",
};

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `il y a ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m}min`;
  const h = Math.round(m / 60);
  return `il y a ${h}h`;
}

export function HistoryPanel({ onClose }: { onClose: () => void }) {
  const log = useWorkspaceStore((s) => s.actionLog);
  const focusSentence = useWorkspaceStore((s) => s.focusSentence);
  const selectClause = useWorkspaceStore((s) => s.selectClause);
  const undo = useWorkspaceStore((s) => s.undo);
  const redo = useWorkspaceStore((s) => s.redo);
  const canUndo = useWorkspaceStore((s) => s.undoStack.length > 0);
  const canRedo = useWorkspaceStore((s) => s.redoStack.length > 0);

  const entries = [...log].reverse();

  return (
    <aside
      data-testid="history-panel"
      aria-label="Historique des actions"
      className="flex h-full w-72 shrink-0 flex-col border-l border-line bg-elevated"
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink">
          Historique ({log.length})
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="undo-btn"
            aria-label="Annuler (⌘Z)"
            title="Annuler — ⌘Z / Ctrl+Z"
            disabled={!canUndo}
            onClick={() => undo()}
            className="rounded px-1.5 py-0.5 text-ink-muted hover:bg-panel-muted disabled:opacity-40"
          >
            ↶
          </button>
          <button
            type="button"
            data-testid="redo-btn"
            aria-label="Rétablir (⌘Y)"
            title="Rétablir — ⌘⇧Z / ⌘Y"
            disabled={!canRedo}
            onClick={() => redo()}
            className="rounded px-1.5 py-0.5 text-ink-muted hover:bg-panel-muted disabled:opacity-40"
          >
            ↷
          </button>
          <button
            type="button"
            data-testid="history-close"
            aria-label="Fermer l'historique"
            onClick={onClose}
            className="rounded px-1 text-ink-muted hover:bg-panel-muted"
          >
            ✕
          </button>
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto p-2">
        {entries.length === 0 && (
          <li className="px-2 py-2 text-xs text-ink-muted">
            Aucune action pour l'instant. Vos modifications apparaîtront ici.
          </li>
        )}
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              data-testid={`history-entry-${e.id}`}
              disabled={e.anchorIndex == null}
              onClick={() => {
                if (e.anchorIndex != null) focusSentence(e.anchorIndex);
                if (e.localId) selectClause(e.localId);
              }}
              className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-panel-muted disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span aria-hidden className="mt-0.5 shrink-0">
                {KIND_ICON[e.kind] ?? "•"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink">{e.label}</span>
                <span className="text-[10px] text-ink-muted">{timeAgo(e.ts)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
