"use client";

/** Liste des documents d'un projet (statut, lien vers l'annotation réelle). navigation.md §1. */

import Link from "next/link";
import { useAssignments, useCorpusDocuments, useProject } from "@/lib/api/hooks";
import { Panel, StatusPill } from "@/components/ui/primitives";

export default function ProjectDocs({ params }: { params: { slug: string } }) {
  const { data: project } = useProject(params.slug);
  // Corpus du projet — plus de repli en dur (H2) ; query désactivée tant qu'inconnu.
  const { data: docs } = useCorpusDocuments(project?.corpusSlug ?? "");
  const { data: assignments } = useAssignments(params.slug);

  // documentId -> { annotationId, status } depuis les assignations réelles.
  const byDoc = new Map(
    (assignments?.results ?? []).map((a) => [
      a.document.id,
      { annotationId: a.annotationId, status: a.status },
    ]),
  );

  const documents = docs?.results ?? [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-4 text-xl font-semibold text-ink">Documents · {params.slug}</h1>
      <Panel className="divide-y divide-line">
        {documents.map((d) => {
          const assigned = byDoc.get(d.id);
          return (
            <div key={d.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium text-ink">{d.title}</div>
                <div className="text-xs text-ink-muted">
                  {d.nSentences} phrases · {d.language}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={assigned?.status ?? "unassigned"} />
                {assigned?.annotationId ? (
                  <Link
                    href={`/annotate/${assigned.annotationId}`}
                    className="text-sm text-accent hover:underline"
                  >
                    Annoter →
                  </Link>
                ) : (
                  <span className="text-xs text-ink-muted">non assigné</span>
                )}
              </div>
            </div>
          );
        })}
        {documents.length === 0 && (
          <div className="px-4 py-6 text-sm text-ink-muted">Aucun document.</div>
        )}
      </Panel>
    </div>
  );
}
