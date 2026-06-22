"use client";

/**
 * ★ AnnotationWorkspace — orchestrateur du cœur produit (F1, F2, F6, F9, F10, F12).
 * Assemble les 3 panneaux redimensionnables, branche le store sur les données
 * serveur (react-query) et active les raccourcis clavier.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Eye } from "lucide-react";
import { useAnnotation, useDocument, useProject, useScheme, useMe } from "@/lib/api/hooks";
import { useWorkspaceStore } from "@/store/workspace";
import { useUiStore } from "@/store/ui";
import { setRuntimeThemes } from "@/lib/tokens";
import { llmJudgeLabel } from "@/lib/llmJudges";
import { ResizablePanels } from "./ResizablePanels";
import { TocPanel } from "./TocPanel";
import { DocumentPanel } from "./DocumentPanel";
import { InspectorPanel } from "./InspectorPanel";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { HistoryPanel } from "./HistoryPanel";
import { CommentsPanel } from "./CommentsPanel";
import { TriageQueue } from "./triage/TriageQueue";
import { TRIAGE_ENABLED } from "@/lib/env";
import { useWorkspaceShortcuts } from "./useShortcuts";
import { useAutosave } from "./useAutosave";

export function AnnotationWorkspace({ annotationId }: { annotationId: string }) {
  const { data: annotation, isLoading: loadingAnn } = useAnnotation(annotationId);
  const { data: doc, isLoading: loadingDoc } = useDocument(annotation?.documentId);
  // Schéma résolu via le projet (plus de slug en dur, H4) : l'app suit le schéma du
  // corpus chargé, quel qu'il soit.
  const { data: project } = useProject(annotation?.projectSlug);
  const { data: scheme } = useScheme(project?.schemeSlug);
  const { data: me } = useMe();
  // Désambiguïsation (plan §P7) : MA session (édition) vs annotation d'autrui (lecture).
  // SÛR PAR DÉFAUT : tant que l'identité (me) ou l'annotation n'est pas confirmée, on
  // considère que ce N'EST PAS ma session → lecture seule, donc aucune écriture sous
  // identité incertaine (évite les 403 d'autosave quand me n'est pas encore chargé).
  const isMine = !!me && !!annotation && String(annotation.annotatorId) === String(me.id);

  const init = useWorkspaceStore((s) => s.init);
  const reset = useWorkspaceStore((s) => s.reset);
  // Source de segmentation affichée (collaboration) : « human » = MA session
  // éditable ; un juge LLM = vue LECTURE (la collaboration aide, ne fait pas
  // référence) ; « compare » = superposition. Sert la bannière de contexte ci-dessous.
  const llmSource = useWorkspaceStore((s) => s.llmSource);
  const isJudgeView = isMine && llmSource !== "human" && llmSource !== "compare";
  const setCurrentProject = useUiStore((s) => s.setCurrentProject);
  // Point f : repli de l'inspecteur (droite) pour gagner de l'espace, persisté.
  const inspectorOpen = useUiStore((s) => s.inspectorOpen);
  const toggleInspector = useUiStore((s) => s.toggleInspector);
  const [snapshotFn, setSnapshotFn] = useState<(() => void) | null>(null);
  const registerSnapshot = useCallback((fn: () => void) => setSnapshotFn(() => fn), []);
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showTriage, setShowTriage] = useState(false);

  // Initialise le store local dès que l'annotation + le document sont chargés.
  useEffect(() => {
    if (annotation && doc) {
      init({
        annotationId: annotation.id,
        nSentences: doc.nSentences,
        clauses: annotation.clauses,
        // R1 — lecture seule stricte sur l'annotation d'un AUTRE annotateur.
        readOnly: !isMine,
      });
    }
    return () => reset();
  }, [annotation, doc, init, reset, isMine]);

  // R4 — aligne le projet courant sur le document réellement ouvert (nav cohérente :
  // file de travail, breadcrumbs, sélecteur de la TopBar suivent ce projet).
  useEffect(() => {
    if (annotation?.projectSlug) setCurrentProject(annotation.projectSlug);
  }, [annotation?.projectSlug, setCurrentProject]);

  // Hydrate couleurs/labels de thèmes depuis le schéma API (H4) ; repli statique
  // (design-tokens.json) en mode démo ou si une couleur manque. Hydratation SYNCHRONE
  // (pendant le rendu), pas dans un effet : setRuntimeThemes mute un état module qui ne
  // déclenche pas de re-rendu — un effet laisserait le 1er rendu (après arrivée du
  // schéma) sur le repli statique, soit un flash de couleurs par défaut pour un corpus
  // tiers. Idempotent ; rebâti seulement quand l'identité du schéma change.
  const hydratedScheme = useRef<unknown>(undefined);
  if (hydratedScheme.current !== scheme) {
    setRuntimeThemes(scheme?.themes ?? null);
    hydratedScheme.current = scheme;
  }
  useEffect(() => () => setRuntimeThemes(null), []);

  // Auto-save : persiste les clauses en arrière-plan (chantier C), sans perte.
  // R1 — UNIQUEMENT sur MA session : un viewer (lecture seule) n'écrit jamais
  // (évite tout 403 parasite et garantit l'intégrité de l'annotation d'autrui).
  useAutosave(isMine ? annotation?.id ?? null : null);

  const themeFocusRef = useRef<(() => void) | null>(null);
  useWorkspaceShortcuts({
    onFocusTheme: () => themeFocusRef.current?.(),
    onComment: () => {
      const el = document.querySelector<HTMLTextAreaElement>('[data-testid="comment-input"]');
      el?.focus();
    },
    onSnapshot: () => snapshotFn?.(),
  });

  if (loadingAnn || loadingDoc || !annotation || !doc) {
    return (
      <div className="flex h-full items-center justify-center text-ink-muted">
        Chargement du workspace…
      </div>
    );
  }

  const themeCodes = scheme?.themes.map((t) => t.code) ?? [];
  const legalNatures = scheme?.legalNatures ?? [];

  return (
    <div className="flex h-full flex-col" data-testid="annotation-workspace">
      <WorkspaceToolbar
        annotationId={annotation.id}
        projectSlug={annotation.projectSlug}
        documentId={annotation.documentId}
        onSnapshotRef={registerSnapshot}
        onToggleHistory={() => setShowHistory((v) => !v)}
        onToggleComments={() => setShowComments((v) => !v)}
        onToggleTriage={isMine ? () => setShowTriage((v) => !v) : undefined}
      />
      {isMine ? (
        <div
          data-testid="session-banner"
          className="flex h-7 shrink-0 items-center gap-1.5 border-b border-line bg-accent/10 px-3 text-xs font-medium text-ink"
        >
          <Pencil size={13} aria-hidden className="text-accent" /> Ma session — édition
        </div>
      ) : (
        <div
          data-testid="session-banner"
          className="flex h-7 shrink-0 items-center gap-1.5 border-b border-line bg-warning/10 px-3 text-xs font-medium text-ink"
        >
          <Eye size={13} aria-hidden className="text-warning" /> Lecture seule — annotation
          d'un autre annotateur (non modifiable)
        </div>
      )}
      {isJudgeView && (
        <div
          data-testid="judge-view-banner"
          role="status"
          className="flex h-7 shrink-0 items-center gap-1.5 border-b border-line bg-sky-400/10 px-3 text-xs font-medium text-ink"
        >
          <Eye size={13} aria-hidden className="text-sky-300" /> Vue lecture —
          segmentation {llmJudgeLabel(llmSource)} (aide ; ne fait pas référence). Repassez
          sur « Humain » pour éditer votre annotation.
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
        <ResizablePanels
          left={<TocPanel docTitle={doc.title} />}
          center={
            <DocumentPanel
              sentences={doc.sentences}
              referenceLabels={doc.referenceLabels}
              documentId={doc.id}
              projectSlug={annotation.projectSlug}
            />
          }
          right={
            <InspectorPanel
              annotationId={annotation.id}
              documentId={annotation.documentId}
              projectSlug={annotation.projectSlug}
              themeCodes={themeCodes}
              legalNatures={legalNatures}
              themeFocusRef={themeFocusRef}
            />
          }
          rightCollapsed={!inspectorOpen}
          onExpandRight={toggleInspector}
          onCollapseRight={toggleInspector}
        />
        </div>
        {showComments && (
          <CommentsPanel
            annotationId={annotation.id}
            documentId={annotation.documentId}
            onClose={() => setShowComments(false)}
          />
        )}
        {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
        {TRIAGE_ENABLED && isMine && showTriage && (
          <TriageQueue
            annotationId={annotation.id}
            documentId={annotation.documentId}
            projectSlug={annotation.projectSlug}
            onClose={() => setShowTriage(false)}
          />
        )}
      </div>
    </div>
  );
}
