"use client";

/**
 * ★ AnnotationWorkspace — orchestrateur du cœur produit (F1, F2, F6, F9, F10, F12).
 * Assemble les 3 panneaux redimensionnables, branche le store sur les données
 * serveur (react-query) et active les raccourcis clavier.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAnnotation, useDocument, useProject, useScheme } from "@/lib/api/hooks";
import { useWorkspaceStore } from "@/store/workspace";
import { setRuntimeThemes } from "@/lib/tokens";
import { ResizablePanels } from "./ResizablePanels";
import { TocPanel } from "./TocPanel";
import { DocumentPanel } from "./DocumentPanel";
import { InspectorPanel } from "./InspectorPanel";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { HistoryPanel } from "./HistoryPanel";
import { CommentsPanel } from "./CommentsPanel";
import { useWorkspaceShortcuts } from "./useShortcuts";
import { useAutosave } from "./useAutosave";

export function AnnotationWorkspace({ annotationId }: { annotationId: string }) {
  const { data: annotation, isLoading: loadingAnn } = useAnnotation(annotationId);
  const { data: doc, isLoading: loadingDoc } = useDocument(annotation?.documentId);
  // Schéma résolu via le projet (plus de slug en dur, H4) : l'app suit le schéma du
  // corpus chargé, quel qu'il soit.
  const { data: project } = useProject(annotation?.projectSlug);
  const { data: scheme } = useScheme(project?.schemeSlug);

  const init = useWorkspaceStore((s) => s.init);
  const reset = useWorkspaceStore((s) => s.reset);
  const [snapshotFn, setSnapshotFn] = useState<(() => void) | null>(null);
  const registerSnapshot = useCallback((fn: () => void) => setSnapshotFn(() => fn), []);
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // Initialise le store local dès que l'annotation + le document sont chargés.
  useEffect(() => {
    if (annotation && doc) {
      init({
        annotationId: annotation.id,
        nSentences: doc.nSentences,
        clauses: annotation.clauses,
      });
    }
    return () => reset();
  }, [annotation, doc, init, reset]);

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
  useAutosave(annotation?.id ?? null);

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
      />
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
      </div>
    </div>
  );
}
