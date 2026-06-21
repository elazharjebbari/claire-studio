"use client";

/** Liste des documents d'un projet (statut, lien vers l'annotation réelle). navigation.md §1. */

import Link from "next/link";
import { useAssignments, useCorpusDocuments, useProject, useMe } from "@/lib/api/hooks";
import { isAdminRole } from "@/lib/roles";
import { Panel, StatusPill } from "@/components/ui/primitives";

export default function ProjectDocs({ params }: { params: { slug: string } }) {
  const { data: project } = useProject(params.slug);
  // Corpus du projet — plus de repli en dur (H2) ; query désactivée tant qu'inconnu.
  const { data: docs } = useCorpusDocuments(project?.corpusSlug ?? "");
  const { data: assignments } = useAssignments(params.slug);
  const { data: me } = useMe();
  const isAdmin = isAdminRole(me?.role);

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
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">
            Documents · {project?.name ?? params.slug}
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Liste de travail : statut d'assignation et accès à l'annotation.
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/admin/projects"
            data-testid="manage-campaign"
            className="shrink-0 rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-medium text-ink hover:bg-panel-muted"
          >
            <span className="text-accent">Gérer la campagne</span> →
          </Link>
        )}
      </div>
      {isAdmin && (
        <p className="mb-4 rounded-md border border-line bg-panel-muted px-3 py-2 text-xs text-ink-muted">
          Vous êtes administrateur. La gestion des documents, l'attribution aux annotateurs
          et le pilotage de la campagne se font dans la{" "}
          <Link href="/admin/projects" className="text-accent hover:underline">
            Console admin → Campagnes
          </Link>{" "}
          et{" "}
          <Link href="/admin/corpora" className="text-accent hover:underline">
            Corpus
          </Link>
          .
        </p>
      )}
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
