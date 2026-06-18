"use client";

/**
 * ★ AnnotationWorkspace — orchestrateur du cœur produit (F1, F2, F6, F9, F10, F12).
 * Assemble les 3 panneaux redimensionnables, branche le store sur les données
 * serveur (react-query) et active les raccourcis clavier.
 */

import { useEffect, useRef, useState } from "react";
import { useAnnotation, useDocument, useScheme } from "@/lib/api/hooks";
import { useWorkspaceStore } from "@/store/workspace";
import { ResizablePanels } from "./ResizablePanels";
import { TocPanel } from "./TocPanel";
import { DocumentPanel } from "./DocumentPanel";
import { InspectorPanel } from "./InspectorPanel";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { useWorkspaceShortcuts } from "./useShortcuts";

export function AnnotationWorkspace({ annotationId }: { annotationId: string }) {
  const { data: annotation, isLoading: loadingAnn } = useAnnotation(annotationId);
  const { data: doc, isLoading: loadingDoc } = useDocument(annotation?.documentId);
  const { data: scheme } = useScheme(annotation?.projectSlug ? "claire-themes-v1" : undefined);

  const init = useWorkspaceStore((s) => s.init);
  const reset = useWorkspaceStore((s) => s.reset);
  const [snapshotFn, setSnapshotFn] = useState<(() => void) | null>(null);

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
        onSnapshotRef={(fn) => setSnapshotFn(() => fn)}
      />
      <div className="min-h-0 flex-1">
        <ResizablePanels
          left={<TocPanel docTitle={doc.title} />}
          center={
            <DocumentPanel
              sentences={doc.sentences}
              referenceLabels={doc.referenceLabels}
            />
          }
          right={
            <InspectorPanel
              annotationId={annotation.id}
              themeCodes={themeCodes}
              legalNatures={legalNatures}
            />
          }
        />
      </div>
    </div>
  );
}
