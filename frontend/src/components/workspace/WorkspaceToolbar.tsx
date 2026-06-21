"use client";

/**
 * Barre d'outils du workspace : navigation documents (point 0b), pré-remplissage LLM
 * COMMUTABLE (point 0a), historique d'actions (point 2), snapshot (F3), certitude
 * globale (F10), soumission VERSIONNÉE (point 2). Indicateur dirty + tour.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, StatusPill } from "@/components/ui/primitives";
import { CertaintyPicker } from "@/components/ui/CertaintyPicker";
import { useWorkspaceStore, type PrefillJudge } from "@/store/workspace";
import { useAutosaveStore } from "@/store/autosave";
import {
  useAnnotation,
  useCreateVersion,
  usePatchAnnotation,
  usePreAnnotations,
} from "@/lib/api/hooks";
import { History, MessageSquare, Layers, BarChart3 } from "lucide-react";
import { preClausesToPivot } from "@/lib/pivot";
import { WorkspaceTourButton } from "./WorkspaceTourButton";
import { DocumentSwitcher } from "./DocumentSwitcher";
import { SubmitDialog } from "./SubmitDialog";
import type { Certainty } from "@/types/contract";

export function WorkspaceToolbar({
  annotationId,
  projectSlug,
  documentId,
  onSnapshotRef,
  onToggleHistory,
  onToggleComments,
}: {
  annotationId: string;
  projectSlug: string;
  documentId: string;
  onSnapshotRef?: (fn: () => void) => void;
  onToggleHistory?: () => void;
  onToggleComments?: () => void;
}) {
  const { data: annotation } = useAnnotation(annotationId);
  const { data: preClaude } = usePreAnnotations(projectSlug, documentId);
  const replacePrefill = useWorkspaceStore((s) => s.replacePrefill);
  const prefilledJudge = useWorkspaceStore((s) => s.prefilledJudge);
  const setGhost = useWorkspaceStore((s) => s.setGhost);
  const dirty = useWorkspaceStore((s) => s.dirty);
  const markClean = useWorkspaceStore((s) => s.markClean);
  const draftClauses = useWorkspaceStore((s) => s.draftClauses);
  // R1 — lecture seule : on neutralise toutes les actions serveur de la barre
  // (soumission, snapshot, certitude, pré-remplissage) sur l'annotation d'autrui.
  const readOnly = useWorkspaceStore((s) => s.readOnly);

  const patchAnnotation = usePatchAnnotation(annotationId);
  const { mutate: createVersionMutate } = useCreateVersion(annotationId);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Pré-remplissage commutable (point 0a) : remplace proprement les clauses seedées.
  function setPrefill(judge: PrefillJudge) {
    if (judge == null) {
      replacePrefill([], null);
      return;
    }
    const pre = preClaude?.results.find((p) => p.judge === judge);
    if (!pre) return;
    replacePrefill(preClausesToPivot(pre.clauses), judge);
  }

  const stats = useMemo(() => {
    const withC = draftClauses.filter((c) => c.certainty != null);
    const mean =
      withC.length === 0
        ? null
        : withC.reduce((a, c) => a + (c.certainty ?? 0), 0) / withC.length;
    return { clauses: draftClauses.length, meanCertainty: mean };
  }, [draftClauses]);

  const snapshot = useCallback(() => {
    createVersionMutate(
      { label: "Snapshot manuel", kind: "snapshot_manuel" },
      {
        onSuccess: () => {
          markClean();
          setSnapshotMsg("Snapshot enregistré");
          setTimeout(() => setSnapshotMsg(null), 2000);
        },
      },
    );
  }, [createVersionMutate, markClean]);

  useEffect(() => {
    onSnapshotRef?.(snapshot);
  }, [onSnapshotRef, snapshot]);

  // Fantômes des deux juges pour l'overlay de comparaison (inchangé).
  useEffect(() => {
    if (!preClaude) return;
    for (const p of preClaude.results) {
      setGhost(
        p.clauses.map((c) => ({ anchorIndex: c.anchorIndex, theme: c.themeCode })),
        p.judge,
      );
    }
  }, [preClaude, setGhost]);

  // Soumission versionnée (point 2) : crée la version de soumission puis passe submitted.
  function confirmSubmit(payload: { name: string; description: string }) {
    setSubmitting(true);
    createVersionMutate(
      { name: payload.name, description: payload.description, kind: "soumission" },
      {
        onSuccess: () => {
          patchAnnotation.mutate(
            { status: "submitted" },
            {
              onSettled: () => {
                markClean();
                setSubmitting(false);
                setSubmitOpen(false);
              },
            },
          );
        },
        onError: () => setSubmitting(false),
      },
    );
  }

  // (SaveIndicator est défini hors composant, plus bas.)

  const PREFILL_OPTIONS: { value: PrefillJudge; label: string; testid: string }[] = [
    { value: null, label: "Aucun", testid: "prefill-none" },
    { value: "claude", label: "Claude", testid: "prefill-claude" },
    { value: "codex", label: "Codex", testid: "prefill-codex" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line bg-elevated px-4 py-2">
      <DocumentSwitcher projectSlug={projectSlug} currentDocumentId={documentId} />

      <StatusPill status={annotation?.status ?? "draft"} />
      <SaveIndicator dirty={dirty} />

      {/* Pré-remplissage commutable (point 0a) */}
      <div
        role="radiogroup"
        aria-label="Pré-remplir depuis un juge LLM"
        data-testid="prefill-switch"
        className="ml-1 flex items-center gap-1 rounded-md border border-line bg-panel-muted/40 p-0.5"
      >
        <span className="px-1 text-[11px] text-ink-muted">Pré-remplir</span>
        {PREFILL_OPTIONS.map((opt) => {
          const active = prefilledJudge === opt.value;
          return (
            <button
              key={opt.testid}
              type="button"
              role="radio"
              aria-checked={active}
              data-testid={opt.testid}
              disabled={readOnly}
              onClick={() => setPrefill(opt.value)}
              className={
                "rounded px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
                (active
                  ? "bg-accent/15 text-ink ring-1 ring-accent/40"
                  : "text-ink-muted hover:bg-panel-muted")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        data-testid="toggle-history"
        onClick={onToggleHistory}
        title="Historique des actions"
        className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-ink-muted hover:bg-panel-muted"
      >
        <History size={14} aria-hidden /> Historique
      </button>

      <button
        type="button"
        data-testid="toggle-comments"
        onClick={onToggleComments}
        title="Commentaires (général / phrase / sélection / clause)"
        className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-ink-muted hover:bg-panel-muted"
      >
        <MessageSquare size={14} aria-hidden /> Commentaires
      </button>

      <a
        href={`/history/${annotationId}`}
        data-testid="versions-link"
        title="Versions enregistrées (document & phrase)"
        className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-ink-muted hover:bg-panel-muted"
      >
        <Layers size={14} aria-hidden /> Versions
      </a>

      <a
        href={`/projects/${projectSlug}/insights`}
        data-testid="insights-link"
        title="Explorer les annotations humaines (corpus & document)"
        className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-ink-muted hover:bg-panel-muted"
      >
        <BarChart3 size={14} aria-hidden /> Insights
      </a>

      <WorkspaceTourButton />

      <div className="ml-auto flex items-center gap-3">
        <div className={"flex items-center gap-2" + (readOnly ? " pointer-events-none opacity-50" : "")}>
          <span className="text-xs text-ink-muted">Certitude globale</span>
          <CertaintyPicker
            size="sm"
            value={annotation?.globalCertainty ?? null}
            onChange={(v: Certainty) =>
              readOnly ? undefined : patchAnnotation.mutate({ global_certainty: v })
            }
          />
        </div>
        {snapshotMsg && (
          <span className="text-[11px] text-emerald-400" data-testid="snapshot-msg">
            {snapshotMsg}
          </span>
        )}
        <Button variant="outline" data-testid="snapshot-btn" disabled={readOnly} onClick={snapshot}>
          Snapshot ⌘S
        </Button>
        <Button
          variant="primary"
          data-testid="submit-btn"
          disabled={readOnly}
          onClick={() => setSubmitOpen(true)}
        >
          Soumettre
        </Button>
      </div>

      {submitOpen && (
        <SubmitDialog
          stats={stats}
          busy={submitting}
          onCancel={() => setSubmitOpen(false)}
          onConfirm={confirmSubmit}
        />
      )}
    </div>
  );
}

/** Indicateur d'état d'enregistrement (chantier C) : en cours / enregistré /
 * hors-ligne / erreur, et « non enregistré » tant qu'aucune synchro n'a eu lieu. */
function SaveIndicator({ dirty }: { dirty: boolean }) {
  const saveState = useAutosaveStore((s) => s.saveState);
  const triggerRetry = useAutosaveStore((s) => s.triggerRetry);
  const view: Record<string, { text: string; cls: string } | null> = {
    saving: { text: "● enregistrement…", cls: "text-amber-400" },
    saved: { text: "✓ enregistré", cls: "text-emerald-400" },
    offline: { text: "⚠ hors-ligne — reprise auto", cls: "text-amber-400" },
    retrying: { text: "↻ échec réseau — nouvelle tentative…", cls: "text-amber-400" },
    error: { text: "✗ échec d'enregistrement", cls: "text-red-400" },
    unauthorized: {
      text: "✗ non enregistré — session expirée ou lecture seule",
      cls: "text-red-400",
    },
    idle: dirty ? { text: "● non enregistré", cls: "text-amber-400" } : null,
  };
  const v = view[saveState] ?? null;
  if (!v) return null;
  return (
    <span
      data-testid="save-indicator"
      data-state={saveState}
      className={`flex items-center gap-1.5 text-[11px] ${v.cls}`}
    >
      {v.text}
      {saveState === "error" && (
        <button
          type="button"
          data-testid="save-retry"
          onClick={() => triggerRetry()}
          className="rounded border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink hover:bg-panel-muted"
        >
          Réessayer
        </button>
      )}
    </span>
  );
}
