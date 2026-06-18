"use client";

/** Historique & versions (F3) — timeline + accès au diff. */

import { useVersions } from "@/lib/api/hooks";
import { Panel } from "@/components/ui/primitives";

export default function HistoryPage({ params }: { params: { id: string } }) {
  const { data } = useVersions(params.id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-4 text-xl font-semibold text-ink">Historique des versions</h1>
      <ol className="relative ml-4 border-l border-line">
        {data?.results.map((v) => (
          <li key={v.id} className="mb-6 ml-4" data-testid="version-item">
            <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-accent" />
            <Panel className="p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">
                  v{v.number} {v.label ? `· ${v.label}` : ""}
                </span>
                <span className="text-xs text-ink-muted">
                  {new Date(v.createdAt).toLocaleString("fr-FR")}
                </span>
              </div>
              <p className="text-sm text-ink-muted">
                {v.snapshot.clauses.length} clause(s) · certitude {v.snapshot.global_certainty} ·
                par {v.authorId}
              </p>
            </Panel>
          </li>
        ))}
        {(!data || data.results.length === 0) && (
          <li className="ml-4 text-sm text-ink-muted">Aucune version enregistrée.</li>
        )}
      </ol>
    </div>
  );
}
