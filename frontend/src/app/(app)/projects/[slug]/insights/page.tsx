"use client";

/**
 * Écran d'exploration des annotations humaines — vue CORPUS (point 5).
 * KPI agrégés, distribution des thèmes, table des documents (avec accès au détail).
 */

import Link from "next/link";
import { useProjectInsights } from "@/lib/api/hooks";
import { Panel } from "@/components/ui/primitives";
import { ThemeBars } from "@/components/insights/ThemeBars";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="p-3 text-center">
      <div className="text-2xl font-semibold text-ink" data-testid="kpi-value">
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</div>
    </Panel>
  );
}

export default function CorpusInsightsPage({ params }: { params: { slug: string } }) {
  const { data, isLoading } = useProjectInsights(params.slug);

  if (isLoading || !data) {
    return <div className="px-6 py-8 text-ink-muted">Chargement des insights…</div>;
  }
  const k = data.kpi;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8" data-testid="corpus-insights">
      <h1 className="mb-1 text-xl font-semibold text-ink">Annotations humaines — {params.slug}</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Vue d'ensemble pour qualifier et explorer le travail d'annotation du corpus.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Annotés" value={`${k.documentsAnnotated}/${k.documentsTotal}`} />
        <Kpi label="Annotateurs" value={String(k.annotators)} />
        <Kpi label="Versions" value={String(k.versions)} />
        <Kpi label="Certitude moy." value={k.meanCertainty == null ? "—" : k.meanCertainty.toFixed(2)} />
        <Kpi label="κ inter-annot." value={k.kappa == null ? "—" : k.kappa.toFixed(2)} />
        <Kpi label="Documents" value={String(data.documents.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Distribution des thèmes
          </h2>
          <Panel className="p-3">
            <ThemeBars data={data.themeDistribution} />
          </Panel>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Documents
          </h2>
          <Panel className="p-2">
            <ul className="flex flex-col gap-1">
              {data.documents.map((d) => (
                <li key={d.documentId}>
                  <Link
                    href={`/projects/${params.slug}/insights/${d.documentId}`}
                    data-testid={`insights-doc-${d.documentId}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-panel-muted"
                  >
                    <span className="min-w-0 truncate text-ink">{d.title}</span>
                    <span className="flex shrink-0 items-center gap-2 text-[11px] text-ink-muted">
                      <span className="rounded bg-panel-muted px-1 uppercase">{d.status}</span>
                      <span>{d.clauses} cl.</span>
                      <span>💬 {d.comments}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
