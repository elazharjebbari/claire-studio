"use client";

/**
 * Barre d'outils du workspace : pré-remplissage LLM (F2), snapshot (F3), certitude
 * globale (F10), soumission (F1). Bandeau de raccourcis + indicateur dirty.
 */

import { useCallback, useEffect, useState } from "react";
import { Button, StatusPill } from "@/components/ui/primitives";
import { CertaintyPicker } from "@/components/ui/CertaintyPicker";
import { useWorkspaceStore } from "@/store/workspace";
import {
  useAnnotation,
  useCreateVersion,
  usePatchAnnotation,
  usePreAnnotations,
} from "@/lib/api/hooks";
import { preClausesToPivot } from "@/lib/pivot";
import type { Certainty, Judge } from "@/types/contract";

export function WorkspaceToolbar({
  annotationId,
  projectSlug,
  documentId,
  onSnapshotRef,
}: {
  annotationId: string;
  projectSlug: string;
  documentId: string;
  onSnapshotRef?: (fn: () => void) => void;
}) {
  const { data: annotation } = useAnnotation(annotationId);
  const { data: preClaude } = usePreAnnotations(projectSlug, documentId);
  const seedFromPre = useWorkspaceStore((s) => s.seedFromPreAnnotation);
  const setGhost = useWorkspaceStore((s) => s.setGhost);
  const dirty = useWorkspaceStore((s) => s.dirty);
  const markClean = useWorkspaceStore((s) => s.markClean);

  const patchAnnotation = usePatchAnnotation(annotationId);
  // On déstructure `mutate` (référence stable en react-query v5) plutôt que l'objet
  // mutation entier (recréé à chaque rendu) → `snapshot` reste stable, pas de boucle d'effet.
  const { mutate: createVersionMutate } = useCreateVersion(annotationId);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);

  function prefillFrom(judge: Judge) {
    const pre = preClaude?.results.find((p) => p.judge === judge);
    if (!pre) return;
    seedFromPre(preClausesToPivot(pre.clauses), judge);
    // Toutes les frontières LLM restent en fantôme pour comparaison.
    setGhost(
      pre.clauses.map((c) => ({ anchorIndex: c.anchorIndex, theme: c.themeCode })),
      judge,
    );
  }

  const snapshot = useCallback(() => {
    createVersionMutate("Snapshot manuel", {
      onSuccess: () => {
        markClean();
        setSnapshotMsg("Snapshot enregistré");
        setTimeout(() => setSnapshotMsg(null), 2000);
      },
    });
  }, [createVersionMutate, markClean]);

  // Expose la fonction snapshot au parent APRÈS le rendu (jamais pendant le rendu,
  // sinon setState du parent pendant le rendu de l'enfant → boucle infinie).
  useEffect(() => {
    onSnapshotRef?.(snapshot);
  }, [onSnapshotRef, snapshot]);

  // Charge les fantômes des DEUX juges dès que les pré-annotations arrivent, indépendamment
  // de l'adoption (F2 : overlay de comparaison). DocumentPanel n'affiche un fantôme que sur
  // une phrase non encore ancrée par l'humain.
  useEffect(() => {
    if (!preClaude) return;
    for (const p of preClaude.results) {
      setGhost(
        p.clauses.map((c) => ({ anchorIndex: c.anchorIndex, theme: c.themeCode })),
        p.judge,
      );
    }
  }, [preClaude, setGhost]);

  return (
    <div className="flex items-center gap-3 border-b border-line bg-elevated px-4 py-2">
      <StatusPill status={annotation?.status ?? "draft"} />
      {dirty && (
        <span className="text-[11px] text-amber-400" data-testid="dirty-indicator">
          ● modifications non enregistrées
        </span>
      )}

      <div className="ml-2 flex items-center gap-1">
        <Button
          variant="subtle"
          data-testid="prefill-claude"
          onClick={() => prefillFrom("claude")}
        >
          Pré-remplir depuis Claude
        </Button>
        <Button
          variant="subtle"
          data-testid="prefill-codex"
          onClick={() => prefillFrom("codex")}
        >
          Codex
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">Certitude globale</span>
          <CertaintyPicker
            size="sm"
            value={annotation?.globalCertainty ?? null}
            onChange={(v: Certainty) => patchAnnotation.mutate({ global_certainty: v })}
          />
        </div>
        {snapshotMsg && (
          <span className="text-[11px] text-emerald-400" data-testid="snapshot-msg">
            {snapshotMsg}
          </span>
        )}
        <Button variant="outline" data-testid="snapshot-btn" onClick={snapshot}>
          Snapshot ⌘S
        </Button>
        <Button
          variant="primary"
          data-testid="submit-btn"
          onClick={() => patchAnnotation.mutate({ status: "submitted" })}
        >
          Soumettre
        </Button>
      </div>
    </div>
  );
}
