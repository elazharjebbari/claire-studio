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
import { useUiStore } from "@/store/ui";
import { validationByIndex, validationSummary } from "@/lib/validation";
import {
  useAnnotation,
  useCreateVersion,
  usePatchAnnotation,
  usePreAnnotations,
} from "@/lib/api/hooks";
import {
  History,
  MessageSquare,
  Layers,
  BarChart3,
  PanelRight,
  ListChecks,
  Lock,
  LockOpen,
} from "lucide-react";
import { TRIAGE_ENABLED } from "@/lib/env";
import { preClausesToPivot } from "@/lib/pivot";
import { LLM_JUDGES } from "@/lib/llmJudges";
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
  onToggleTriage,
  locked = false,
  onLock,
  onRequestUnlock,
  projectLocked = false,
}: {
  annotationId: string;
  projectSlug: string;
  documentId: string;
  onSnapshotRef?: (fn: () => void) => void;
  onToggleHistory?: () => void;
  onToggleComments?: () => void;
  onToggleTriage?: () => void;
  /** Verrouillage : état + actions (définies seulement pour le propriétaire). */
  locked?: boolean;
  onLock?: () => void;
  onRequestUnlock?: () => void;
  /** Verrou NIVEAU PROJET : non déverrouillable par l'annotateur (admin requis). */
  projectLocked?: boolean;
}) {
  const { data: annotation } = useAnnotation(annotationId);
  const { data: preClaude } = usePreAnnotations(projectSlug, documentId);
  const replacePrefill = useWorkspaceStore((s) => s.replacePrefill);
  const prefilledJudge = useWorkspaceStore((s) => s.prefilledJudge);
  const setGhost = useWorkspaceStore((s) => s.setGhost);
  const dirty = useWorkspaceStore((s) => s.dirty);
  const markClean = useWorkspaceStore((s) => s.markClean);
  const draftClauses = useWorkspaceStore((s) => s.draftClauses);
  const nSentences = useWorkspaceStore((s) => s.nSentences);
  // R1 — lecture seule : on neutralise toutes les actions serveur de la barre
  // (soumission, snapshot, certitude, pré-remplissage) sur l'annotation d'autrui.
  const readOnly = useWorkspaceStore((s) => s.readOnly);
  const inspectorOpen = useUiStore((s) => s.inspectorOpen);
  const toggleInspector = useUiStore((s) => s.toggleInspector);

  const patchAnnotation = usePatchAnnotation(annotationId);
  const { mutate: createVersionMutate } = useCreateVersion(annotationId);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Erreur de soumission (échec du flush anti-perte ou des mutations) affichée
  // dans le dialog — distincte du gate de validation (`submitBlockReason`).
  const [submitError, setSubmitError] = useState<string | null>(null);
  const flushAutosave = useAutosaveStore((s) => s.flush);
  // Juge en attente de CONFIRMATION d'écrasement (le pré-remplissage remplace tout).
  const [pendingPrefill, setPendingPrefill] = useState<Exclude<PrefillJudge, null> | null>(null);

  // Pré-remplissage : applique la segmentation du juge (ÉCRASE l'annotation courante)
  // ou retire le pré-remplissage (judge = null).
  function setPrefill(judge: PrefillJudge) {
    if (judge == null) {
      replacePrefill([], null);
      return;
    }
    const pre = preClaude?.results.find((p) => p.judge === judge);
    if (!pre) return;
    replacePrefill(preClausesToPivot(pre.clauses), judge);
  }

  // Demande de pré-remplissage : confirme l'ÉCRASEMENT si des annotations existent
  // (sinon applique directement). « Aucun » s'applique sans confirmation.
  function requestPrefill(judge: PrefillJudge) {
    if (judge == null) {
      setPrefill(null);
      return;
    }
    if (draftClauses.length > 0) setPendingPrefill(judge);
    else setPrefill(judge);
  }

  const stats = useMemo(() => {
    const withC = draftClauses.filter((c) => c.certainty != null);
    const mean =
      withC.length === 0
        ? null
        : withC.reduce((a, c) => a + (c.certainty ?? 0), 0) / withC.length;
    return { clauses: draftClauses.length, meanCertainty: mean };
  }, [draftClauses]);

  // Point d — gate de soumission : bloquée tant que toute phrase n'est pas VALIDÉE.
  const validation = useMemo(
    () => validationSummary(validationByIndex(draftClauses, nSentences)),
    [draftClauses, nSentences],
  );
  const submitBlockReason = validation.complete
    ? null
    : `${validation.pending + validation.uncovered} phrase${
        validation.pending + validation.uncovered > 1 ? "s" : ""
      } non validée${validation.pending + validation.uncovered > 1 ? "s" : ""}`;

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

  // Soumission versionnée (point 2). ANTI-PERTE : le snapshot de version est figé
  // CÔTÉ SERVEUR à partir des clauses déjà persistées. On FLUSH donc l'autosave et on
  // attend la convergence AVANT de créer la version — sinon une modification récente
  // (débounce non écoulé, synchro en vol, autosave en erreur) serait perdue du
  // snapshot soumis. Si la convergence échoue, on abandonne et on explique.
  async function confirmSubmit(payload: { name: string; description: string }) {
    setSubmitting(true);
    setSubmitError(null);

    const flush = flushAutosave;
    const result = flush ? await flush() : { converged: true, state: "idle" as const };
    if (!result.converged) {
      setSubmitting(false);
      setSubmitError(
        result.state === "unauthorized"
          ? "Session expirée ou annotation non modifiable : vos dernières modifications ne sont pas enregistrées. Reconnectez-vous, puis réessayez."
          : "Des modifications ne sont pas encore enregistrées sur le serveur. Patientez quelques secondes (ou utilisez « Réessayer ») puis soumettez à nouveau — pour ne perdre aucune donnée.",
      );
      return;
    }

    createVersionMutate(
      { name: payload.name, description: payload.description, kind: "soumission" },
      {
        onSuccess: () => {
          patchAnnotation.mutate(
            { status: "submitted" },
            {
              onSuccess: () => {
                // markClean UNIQUEMENT au vrai succès du passage `submitted`
                // (ne pas masquer un état « non enregistré » sur échec).
                markClean();
                setSubmitOpen(false);
              },
              onError: () =>
                setSubmitError(
                  "La version a été créée mais le passage en « soumise » a échoué. Réessayez la soumission.",
                ),
              onSettled: () => setSubmitting(false),
            },
          );
        },
        onError: () => {
          setSubmitting(false);
          setSubmitError("La soumission a échoué (création de la version). Réessayez.");
        },
      },
    );
  }

  // (SaveIndicator est défini hors composant, plus bas.)

  // Options de pré-remplissage générées depuis la config des juges (N-modèles : Mistral
  // inclus). Un juge sans pré-annotation pour ce document est désactivé.
  const availableJudges = new Set<string>((preClaude?.results ?? []).map((p) => p.judge));
  const PREFILL_OPTIONS: { value: PrefillJudge; label: string; testid: string }[] = [
    { value: null, label: "Aucun", testid: "prefill-none" },
    ...LLM_JUDGES.map((j) => ({
      value: j.id as PrefillJudge,
      label: j.label,
      testid: `prefill-${j.id}`,
    })),
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
          // Désactivé si lecture seule, ou si ce juge n'a pas de données pour ce document.
          const noData = opt.value != null && !availableJudges.has(opt.value);
          return (
            <button
              key={opt.testid}
              type="button"
              role="radio"
              aria-checked={active}
              data-testid={opt.testid}
              disabled={readOnly || noData}
              title={noData ? "Aucune pré-annotation de ce modèle pour ce document" : undefined}
              onClick={() => requestPrefill(opt.value)}
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

      {TRIAGE_ENABLED && onToggleTriage && (
        <button
          type="button"
          data-testid="toggle-triage"
          onClick={onToggleTriage}
          title="File de triage — suggestions d'annotation par niveau de confiance (C1–C5)"
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-ink-muted hover:bg-panel-muted"
        >
          <ListChecks size={14} aria-hidden /> File de triage
        </button>
      )}

      <button
        type="button"
        data-testid="toggle-inspector"
        onClick={toggleInspector}
        aria-pressed={inspectorOpen}
        title={inspectorOpen ? "Replier l'inspecteur" : "Déplier l'inspecteur"}
        className={
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-panel-muted " +
          (inspectorOpen
            ? "border-accent/40 bg-accent/10 text-ink"
            : "border-line text-ink-muted")
        }
      >
        <PanelRight size={14} aria-hidden /> Inspecteur
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
        <span
          data-testid="validation-meter"
          title={
            validation.complete
              ? "Toutes les phrases sont validées"
              : `${validation.validated}/${validation.total} validées · ${validation.pending} en attente · ${validation.uncovered} sans clause`
          }
          className={
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium " +
            (validation.complete
              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
              : "border-amber-400/40 bg-amber-400/10 text-amber-300")
          }
        >
          {validation.complete ? "✓" : "◷"} {validation.validated}/{validation.total}
        </span>
        {/* Cadenas (point 2) : verrouiller/déverrouiller. Affiché pour le propriétaire. */}
        {projectLocked ? (
          <span
            data-testid="toolbar-project-locked"
            title="Projet verrouillé par un administrateur — campagne gelée"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-400/40 bg-slate-400/10 px-2.5 py-1 text-sm font-medium text-slate-300"
          >
            <Lock size={14} aria-hidden /> Projet verrouillé
          </span>
        ) : locked && onRequestUnlock ? (
          <button
            type="button"
            data-testid="toolbar-unlock"
            onClick={onRequestUnlock}
            title="Document verrouillé — cliquez pour déverrouiller"
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/50 bg-amber-400/10 px-2.5 py-1 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-400/20"
          >
            <Lock size={14} aria-hidden /> Verrouillé
          </button>
        ) : (
          onLock && (
            <button
              type="button"
              data-testid="toolbar-lock"
              onClick={onLock}
              title="Verrouiller (gèle l'édition)"
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-sm font-medium text-ink-muted transition-colors hover:bg-panel-muted hover:text-ink"
            >
              <LockOpen size={14} aria-hidden /> Verrouiller
            </button>
          )
        )}
        <Button
          variant="primary"
          data-testid="submit-btn"
          disabled={readOnly}
          onClick={() => {
            setSubmitError(null);
            setSubmitOpen(true);
          }}
        >
          Soumettre
        </Button>
      </div>

      {submitOpen && (
        <SubmitDialog
          stats={stats}
          busy={submitting}
          blockReason={submitBlockReason}
          submitError={submitError}
          onCancel={() => {
            setSubmitOpen(false);
            setSubmitError(null);
          }}
          onConfirm={confirmSubmit}
        />
      )}

      {/* Confirmation d'ÉCRASEMENT par pré-remplissage (annulable ⌘Z). */}
      {pendingPrefill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          data-testid="prefill-confirm"
        >
          <div className="w-full max-w-md rounded-lg border border-line bg-elevated p-5 shadow-xl">
            <h2 className="font-display text-lg font-semibold text-ink">
              Remplacer l'annotation par {pendingPrefill === "claude" ? "Claude" : "Codex"} ?
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Le pré-remplissage applique la segmentation de{" "}
              <strong className="text-ink">
                {pendingPrefill === "claude" ? "Claude" : "Codex"}
              </strong>{" "}
              et <strong className="text-warning">écrase TOUTES vos annotations actuelles</strong>{" "}
              (y compris les annotations humaines). Vous pourrez ensuite les modifier, et{" "}
              <strong className="text-ink">annuler</strong> ce remplacement (⌘Z ou l'historique).
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                data-testid="prefill-cancel"
                onClick={() => setPendingPrefill(null)}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                data-testid="prefill-confirm-ok"
                onClick={() => {
                  const j = pendingPrefill;
                  setPendingPrefill(null);
                  setPrefill(j);
                }}
              >
                Remplacer
              </Button>
            </div>
          </div>
        </div>
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
      // a11y : région live polie — les lecteurs d'écran annoncent les changements
      // d'état d'enregistrement (enregistrement / enregistré / échec) sans voler le focus.
      role="status"
      aria-live="polite"
      aria-atomic="true"
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
