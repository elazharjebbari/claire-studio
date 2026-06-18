"use client";

/** Liste des projets visibles (navigation.md §1) — cartes avancement / IAA / rôle. */

import Link from "next/link";
import { useProjects } from "@/lib/api/hooks";
import { Panel, Badge } from "@/components/ui/primitives";

export default function ProjectsPage() {
  const { data } = useProjects();
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-4 text-xl font-semibold text-ink">Projets</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {data?.results.map((p) => (
          <Link key={p.slug} href={`/projects/${p.slug}`}>
            <Panel className="p-4 transition-colors hover:border-accent/50">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-ink">{p.name}</h2>
                {p.myRole && <Badge>{p.myRole}</Badge>}
              </div>
              <p className="mt-1 text-sm text-ink-muted">{p.corpusSlug}</p>
              {p.progress && (
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <dt className="text-ink-muted">Annotés</dt>
                    <dd className="text-ink">
                      {p.progress.annotatedDocuments}/{p.progress.totalDocuments}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Approuvés</dt>
                    <dd className="text-ink">{p.progress.approvedDocuments}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">IAA</dt>
                    <dd className="text-ink">
                      {p.progress.iaa != null ? p.progress.iaa.toFixed(2) : "—"}
                    </dd>
                  </div>
                </dl>
              )}
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
