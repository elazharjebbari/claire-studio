"use client";

/** Documents d'un projet : 1 ligne PAR document + statut de MA session (ADR-001). */

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectDocuments, useProject, useMe } from "@/lib/api/hooks";
import { createAnnotation } from "@/lib/api/endpoints";
import { isAdminRole } from "@/lib/roles";
import { Panel, StatusPill } from "@/components/ui/primitives";

export default function ProjectDocs({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const { data: project } = useProject(params.slug);
  // Une entrée PAR document (jamais dupliqué) + ma session sur chacun.
  const { data: docs } = useProjectDocuments(params.slug, { mine: true });
  const { data: me } = useMe();
  const isAdmin = isAdminRole(me?.role);
  const [opening, setOpening] = useState<string | null>(null);

  const documents = docs?.results ?? [];

  async function open(externalId: string) {
    if (opening) return;
    setOpening(externalId);
    try {
      const ann = await createAnnotation({ project: params.slug, document: externalId });
      router.push(`/annotate/${ann.id}`);
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">
            Documents · {project?.name ?? params.slug}
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Liste de travail : statut de <strong className="text-ink">ma session</strong> et
            accès à l'annotation (1 ligne par document).
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
          Vous êtes administrateur. L'attribution aux annotateurs et la supervision se font
          dans la{" "}
          <Link href="/admin/projects" className="text-accent hover:underline">
            Console admin → Campagnes
          </Link>
          . Cette liste montre <strong className="text-ink">votre propre</strong> session.
        </p>
      )}
      <Panel className="divide-y divide-line">
        {documents.map((d) => {
          const status = d.mySession?.status ?? "unstarted";
          const assigned = d.mySession?.assigned;
          return (
            <div key={d.document.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium text-ink">{d.document.title}</div>
                <div className="text-xs text-ink-muted">
                  {d.document.nSentences} phrases · {d.document.language}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={status} />
                <button
                  type="button"
                  disabled={opening === d.document.externalId}
                  onClick={() => open(d.document.externalId)}
                  data-testid={`open-doc-${d.document.externalId}`}
                  className="text-sm text-accent hover:underline disabled:opacity-50"
                >
                  {opening === d.document.externalId
                    ? "Ouverture…"
                    : assigned || status !== "unstarted"
                      ? "Annoter →"
                      : "Annoter (libre) →"}
                </button>
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
