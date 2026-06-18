"use client";

/** Liste des documents d'un projet (statut, annotateurs, filtres). navigation.md §1. */

import Link from "next/link";
import { useCorpusDocuments, useProject } from "@/lib/api/hooks";
import { Panel, StatusPill } from "@/components/ui/primitives";

export default function ProjectDocs({ params }: { params: { slug: string } }) {
  const { data: project } = useProject(params.slug);
  const { data: docs } = useCorpusDocuments(project?.corpusSlug ?? "claudette-tos");

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-4 text-xl font-semibold text-ink">Documents · {params.slug}</h1>
      <Panel className="divide-y divide-line">
        {docs?.results.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="font-medium text-ink">{d.title}</div>
              <div className="text-xs text-ink-muted">
                {d.nSentences} phrases · {d.language}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill status="draft" />
              <Link href="/annotate/ann-1" className="text-sm text-accent hover:underline">
                Annoter →
              </Link>
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}
