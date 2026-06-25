"use client";

/**
 * Barre d'outils du workspace : navigation documents (point 0b), pré-remplissage LLM
 * COMMUTABLE (point 0a), historique d'actions (point 2), snapshot (F3), certitude
 * globale (F10), soumission VERSIONNÉE (point 2). Indicateur dirty + tour.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, StatusPill } from "@/components/ui/primitives";
import { CertaintyPicker } from "@/components/ui/CertaintyPicker";
import { useWorkspaceStore, type PrefillJudge } from "@/store/workspace";
import { useAutosaveStore } from "@/store/autosave";
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
  WandSparkles,
  Wrench,
  ChevronDown,
} from "lucide-react";
import { TRIAGE_ENABLED } from "@/lib/env";
import { preClausesToPivot } from "@/lib/pivot";
import { LLM_JUDGES, llmJudgeLabel } from "@/lib/llmJudges";
import { usePrefsStore } from "@/store/prefs";
import { WorkspaceTourButton } from "./WorkspaceTourButton";
import { DocumentSwitcher } from "./DocumentSwitcher";
import { SubmitDialog } from "./SubmitDialog";
import { SubmitSuccessDialog } from "./SubmitSuccessDialog";
import { SubmissionProgressDialog, type SubmissionPhase } from "./SubmissionProgressDialog";
import { AutoPrefillConsentDialog } from "./AutoPrefillConsentDialog";
import { PreferencesPopover } from "./PreferencesPopover";
import { ConcordanceWidget } from "./ConcordanceWidget";
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
  onUnlock,
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
  /** Déverrouillage DIRECT (depuis la modale de succès de soumission) — rouvre en brouillon. */
  onUnlock?: () => void;
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
  // Panneau inspecteur : état PAR COMPTE (store de prefs, synchronisé serveur).
  const inspectorOpen = usePrefsStore((s) => s.prefs.panels.inspectorOpen);
  const setPanel = usePrefsStore((s) => s.setPanel);
  const toggleInspector = () => setPanel("inspectorOpen", !inspectorOpen);
  // Auto-pré-annotation (point produit) : préférence PAR COMPTE.
  const autoPrefill = usePrefsStore((s) => s.prefs.prefill);
  const setPrefillPref = usePrefsStore((s) => s.setPrefill);

  const patchAnnotation = usePatchAnnotation(annotationId);
  const createVersion = useCreateVersion(annotationId);
  const createVersionMutate = createVersion.mutate;
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Soumission en TÂCHE DE FOND (barre de progression + notification) : phase courante +
  // erreur éventuelle. null = pas de soumission en cours. Le dernier payload sert au « Réessayer ».
  const [submission, setSubmission] = useState<{ phase: SubmissionPhase; error: string | null } | null>(null);
  const lastSubmitPayload = useRef<{ name: string; description: string } | null>(null);
  // Confirmation de SUCCÈS (point 1) : nom de la version soumise (null = modale fermée).
  const [submittedName, setSubmittedName] = useState<string | null>(null);
  // Erreur de soumission (échec du flush anti-perte ou des mutations) affichée
  // dans le dialog — distincte du gate de validation (`submitBlockReason`).
  const [submitError, setSubmitError] = useState<string | null>(null);
  const flushAutosave = useAutosaveStore((s) => s.flush);
  // Juge en attente de CONFIRMATION d'écrasement (le pré-remplissage remplace tout).
  const [pendingPrefill, setPendingPrefill] = useState<Exclude<PrefillJudge, null> | null>(null);
  // Juge pour lequel on DEMANDE le consentement auto-prefill (1ère exécution manuelle).
  const [consentJudge, setConsentJudge] = useState<string | null>(null);
  // L8 — tiroir « Outils » : regroupe les destinations secondaires (pré-remplissage,
  // panneaux, navigation) pour désencombrer la barre. Fermé au clic extérieur / Échap.
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!toolsOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      // Ne pas fermer le tiroir si on clique dans une MODALE qu'il a ouverte (confirmation
      // d'écrasement de pré-remplissage, consentement) — sinon le flux devient impossible.
      const inDialog = t instanceof Element && t.closest('[role="dialog"]');
      if (toolsRef.current && !toolsRef.current.contains(t) && !inDialog) setToolsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setToolsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [toolsOpen]);

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
    // 1ère exécution MANUELLE → demander si on auto-exécute désormais (une seule fois/compte).
    if (!usePrefsStore.getState().prefs.prefill.asked) setConsentJudge(judge);
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

  // Soumission en TÂCHE DE FOND, séquencée en 3 étapes avec barre de progression et
  // notification de fin (au lieu d'un message bloquant). ANTI-PERTE : le snapshot de version
  // est figé CÔTÉ SERVEUR à partir des clauses persistées — on FLUSH d'abord (avec
  // réconciliation → convergence garantie). À chaque échec d'étape : état d'erreur + « Réessayer ».
  async function runSubmission(payload: { name: string; description: string }) {
    lastSubmitPayload.current = payload;
    setSubmitOpen(false);
    setSubmitError(null);
    setSubmitting(true);

    // Étape 1 — Enregistrement (flush anti-perte).
    setSubmission({ phase: "save", error: null });
    const flush = flushAutosave;
    const result = flush ? await flush() : { converged: true, state: "idle" as const };
    if (!result.converged) {
      setSubmitting(false);
      setSubmission({
        phase: "save",
        error:
          result.state === "unauthorized"
            ? "Session expirée ou annotation non modifiable : reconnectez-vous, puis réessayez."
            : "Des modifications n'ont pas pu être enregistrées sur le serveur. Vérifiez votre connexion puis réessayez (aucune donnée n'est perdue).",
      });
      return;
    }

    try {
      // Étape 2 — Création de la version figée (snapshot immuable).
      setSubmission({ phase: "version", error: null });
      await createVersion.mutateAsync({
        name: payload.name,
        description: payload.description,
        kind: "soumission",
      });

      // Étape 3 — Publication (passage en « soumise »).
      setSubmission({ phase: "publish", error: null });
      await patchAnnotation.mutateAsync({ status: "submitted" });

      markClean();
      setSubmission(null); // ferme la progression…
      setSubmittedName(payload.name); // …et notifie le SUCCÈS (verrouillage + déverrouillage).
    } catch {
      // Échec d'une mutation : on reste sur l'étape courante en erreur (Réessayer relance tout).
      setSubmission((cur) => ({
        phase: cur?.phase ?? "version",
        error:
          "La publication a échoué à cette étape. Vos données sont enregistrées — réessayez.",
      }));
    } finally {
      setSubmitting(false);
    }
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

      {/* L8 — Tiroir « Outils » : regroupe les destinations secondaires (pré-remplissage,
          panneaux, navigation, certitude globale) pour désencombrer la barre (3 zones :
          Contexte · Outils · Actions). Révélation à la demande. */}
      <div ref={toolsRef} className="relative">
        <button
          type="button"
          data-testid="tools-drawer"
          aria-expanded={toolsOpen}
          aria-haspopup="true"
          onClick={() => setToolsOpen((v) => !v)}
          title="Outils : pré-remplissage, panneaux, navigation"
          className={
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors " +
            (toolsOpen
              ? "border-accent/40 bg-accent/10 text-ink"
              : "border-line text-ink-muted hover:bg-panel-muted hover:text-ink")
          }
        >
          <Wrench size={14} aria-hidden /> Outils
          <ChevronDown
            size={12}
            aria-hidden
            className={"transition-transform " + (toolsOpen ? "rotate-180" : "")}
          />
        </button>
        {toolsOpen && (
          <div
            aria-label="Outils"
            data-testid="tools-drawer-panel"
            className="absolute left-0 top-9 z-40 flex w-72 flex-col gap-2 rounded-lg border border-line bg-elevated p-2 shadow-xl"
          >
            {/* Pré-remplissage — action DESTRUCTRICE (écrase l'annotation) : cadre WARNING. */}
            <div className="rounded-md border border-warning/40 bg-warning/5 p-1.5">
              <div
                role="radiogroup"
                aria-label="Pré-remplir depuis un juge LLM"
                data-testid="prefill-switch"
                className="flex flex-wrap items-center gap-1"
              >
                <span className="px-1 text-[11px] font-semibold uppercase text-warning">Pré-remplir ⚠</span>
                {PREFILL_OPTIONS.map((opt) => {
                  const active = prefilledJudge === opt.value;
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
                          ? "bg-warning/20 text-ink ring-1 ring-warning/50"
                          : "text-ink-muted hover:bg-panel-muted")
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  data-testid="autoprefill-toggle"
                  aria-pressed={autoPrefill.enabled}
                  disabled={readOnly || !autoPrefill.judge}
                  onClick={() => setPrefillPref({ enabled: !autoPrefill.enabled })}
                  title={
                    autoPrefill.judge
                      ? autoPrefill.enabled
                        ? `Auto-pré-annotation activée : ${llmJudgeLabel(autoPrefill.judge)} (à l'ouverture d'un document vierge)`
                        : `Auto-pré-annotation désactivée — cliquez pour activer (${llmJudgeLabel(autoPrefill.judge)})`
                      : "Auto-pré-annotation : choisissez d'abord un modèle (Préférences)"
                  }
                  className={
                    "inline-flex items-center rounded-md border p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
                    (autoPrefill.enabled
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-line text-ink-muted hover:bg-panel-muted hover:text-ink")
                  }
                >
                  <WandSparkles size={14} aria-hidden />
                </button>
              </div>
              <p className="px-1 pt-1 text-[10px] text-ink-muted">Écrase l'annotation courante (annulable ⌘Z).</p>
            </div>

            {/* Panneaux */}
            <div className="flex flex-col gap-1">
              <button
                type="button"
                data-testid="toggle-inspector"
                onClick={() => {
                  toggleInspector();
                  setToolsOpen(false);
                }}
                aria-pressed={inspectorOpen}
                title={inspectorOpen ? "Replier l'inspecteur" : "Déplier l'inspecteur"}
                className={
                  "inline-flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-panel-muted " +
                  (inspectorOpen ? "border-accent/40 bg-accent/10 text-ink" : "border-line text-ink-muted")
                }
              >
                <PanelRight size={14} aria-hidden /> Inspecteur
              </button>
              <button
                type="button"
                data-testid="toggle-history"
                onClick={() => {
                  onToggleHistory?.();
                  setToolsOpen(false);
                }}
                title="Historique des actions"
                className="inline-flex w-full items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-ink-muted hover:bg-panel-muted"
              >
                <History size={14} aria-hidden /> Historique
              </button>
              <button
                type="button"
                data-testid="toggle-comments"
                onClick={() => {
                  onToggleComments?.();
                  setToolsOpen(false);
                }}
                title="Commentaires (général / phrase / sélection / clause)"
                className="inline-flex w-full items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-ink-muted hover:bg-panel-muted"
              >
                <MessageSquare size={14} aria-hidden /> Commentaires
              </button>
              {TRIAGE_ENABLED && onToggleTriage && (
                <button
                  type="button"
                  data-testid="toggle-triage"
                  onClick={() => {
                    onToggleTriage?.();
                    setToolsOpen(false);
                  }}
                  title="File de triage — suggestions d'annotation par niveau de confiance (C1–C5)"
                  className="inline-flex w-full items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-ink-muted hover:bg-panel-muted"
                >
                  <ListChecks size={14} aria-hidden /> File de triage
                </button>
              )}
            </div>

            {/* Navigation */}
            <div className="flex flex-col gap-1 border-t border-line/60 pt-2">
              <a
                href={`/history/${annotationId}`}
                data-testid="versions-link"
                title="Versions enregistrées (document & phrase)"
                className="inline-flex w-full items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-ink-muted hover:bg-panel-muted"
              >
                <Layers size={14} aria-hidden /> Versions
              </a>
              <a
                href={`/projects/${projectSlug}/insights`}
                data-testid="insights-link"
                title="Explorer les annotations humaines (corpus & document)"
                className="inline-flex w-full items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-ink-muted hover:bg-panel-muted"
              >
                <BarChart3 size={14} aria-hidden /> Insights
              </a>
            </div>

            {/* Certitude globale (réglage rare) + visite guidée. */}
            <div
              className={
                "flex items-center justify-between gap-2 border-t border-line/60 pt-2" +
                (readOnly ? " pointer-events-none opacity-50" : "")
              }
            >
              <span className="text-xs text-ink-muted">Certitude globale</span>
              <CertaintyPicker
                size="sm"
                value={annotation?.globalCertainty ?? null}
                onChange={(v: Certainty) =>
                  readOnly ? undefined : patchAnnotation.mutate({ global_certainty: v })
                }
              />
            </div>
          </div>
        )}
      </div>

      <WorkspaceTourButton />

      <div className="ml-auto flex items-center gap-3">
        <PreferencesPopover />
        {snapshotMsg && (
          <span className="text-[11px] text-success" data-testid="snapshot-msg">
            {snapshotMsg}
          </span>
        )}
        {/* Point 4 — concordance temps réel avec les modèles (pastille + carte dépliable). */}
        <ConcordanceWidget projectSlug={projectSlug} documentId={documentId} />
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
              ? "border-success/40 bg-success/10 text-success"
              : "border-warning/40 bg-warning/10 text-warning")
          }
        >
          {validation.complete ? "✓" : "◷"} {validation.validated}/{validation.total}
        </span>
        {/* Cadenas (point 2) : verrouiller/déverrouiller. Affiché pour le propriétaire. */}
        {projectLocked ? (
          <span
            data-testid="toolbar-project-locked"
            title="Projet verrouillé par un administrateur — campagne gelée"
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-muted/40 bg-ink-muted/10 px-2.5 py-1 text-sm font-medium text-ink-muted"
          >
            <Lock size={14} aria-hidden /> Projet verrouillé
          </span>
        ) : locked && onRequestUnlock ? (
          <button
            type="button"
            data-testid="toolbar-unlock"
            onClick={onRequestUnlock}
            title="Document verrouillé — cliquez pour déverrouiller"
            className="inline-flex items-center gap-1.5 rounded-md border border-warning/50 bg-warning/10 px-2.5 py-1 text-sm font-medium text-warning transition-colors hover:bg-warning/20"
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
          onConfirm={runSubmission}
        />
      )}

      {/* Soumission en TÂCHE DE FOND : barre de progression + notification d'échec/retry. */}
      {submission && (
        <SubmissionProgressDialog
          phase={submission.phase}
          error={submission.error}
          onRetry={() => lastSubmitPayload.current && runSubmission(lastSubmitPayload.current)}
          onClose={() => setSubmission(null)}
        />
      )}

      {/* Confirmation de SUCCÈS de soumission (point 1). */}
      {submittedName !== null && (
        <SubmitSuccessDialog
          versionName={submittedName}
          onClose={() => setSubmittedName(null)}
          onUnlock={onUnlock}
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
              Remplacer l'annotation par {llmJudgeLabel(pendingPrefill)} ?
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Le pré-remplissage applique la segmentation de{" "}
              <strong className="text-ink">{llmJudgeLabel(pendingPrefill)}</strong>{" "}
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

      {/* 1ère exécution manuelle du prefill → demander l'auto-exécution (une fois/compte). */}
      {consentJudge && (
        <AutoPrefillConsentDialog
          judge={consentJudge}
          onActivate={() => {
            setPrefillPref({ enabled: true, judge: consentJudge, asked: true });
            setConsentJudge(null);
          }}
          onDecline={() => {
            setPrefillPref({ asked: true });
            setConsentJudge(null);
          }}
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
    saving: { text: "● enregistrement…", cls: "text-warning" },
    saved: { text: "✓ enregistré", cls: "text-success" },
    offline: { text: "⚠ hors-ligne — reprise auto", cls: "text-warning" },
    retrying: { text: "↻ échec réseau — nouvelle tentative…", cls: "text-warning" },
    error: { text: "✗ échec d'enregistrement", cls: "text-danger" },
    unauthorized: {
      text: "✗ non enregistré — session expirée ou lecture seule",
      cls: "text-danger",
    },
    idle: dirty ? { text: "● non enregistré", cls: "text-warning" } : null,
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
