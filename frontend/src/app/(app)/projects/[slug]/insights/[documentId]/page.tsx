"use client";

/**
 * Écran d'exploration des annotations humaines — vue DOCUMENT (point 5).
 * KPI du document, distribution locale des thèmes, certitude par clause, et zone de
 * REMARQUES (commentaires de portée document) pour qualifier l'annotation.
 */

import { useState } from "react";
import Link from "next/link";
import { useAddComment, useComments, useDocumentInsights } from "@/lib/api/hooks";
import { Panel } from "@/components/ui/primitives";
import { getThemeToken, getCertaintyToken } from "@/lib/tokens";
import { ThemeBars } from "@/components/insights/ThemeBars";

export default function DocumentInsightsPage({
  params,
}: {
  params: { slug: string; documentId: string };
}) {
  const { data, isLoading } = useDocumentInsights(params.slug, params.documentId);
  const annotationId = data?.annotationId ?? "";
  const { data: commentsData } = useComments(annotationId || undefined);
  const addComment = useAddComment(annotationId);
  const [remark, setRemark] = useState("");

  if (isLoading || !data) {
    return <div className="px-6 py-8 text-ink-muted">Chargement…</div>;
  }
  const k = data.kpi;
  const remarks = (commentsData?.results ?? []).filter((c) => c.scope === "document");

  return (
    <div className="mx-auto max-w-4xl px-6 py-8" data-testid="document-insights">
      <Link
        href={`/projects/${params.slug}/insights`}
        className="text-xs text-accent hover:underline"
      >
        ← Retour au corpus
      </Link>
      <h1 className="mb-4 mt-1 text-xl font-semibold text-ink">{data.title}</h1>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Kpi
          label="Pages (≈)"
          value={
            data.approxPages != null
              ? `${data.approxPages}${data.nSentences ? ` · ${data.nSentences} ph.` : ""}`
              : "—"
          }
        />
        <Kpi label="Clauses" value={String(k.clauses)} />
        <Kpi label="Certitude moy." value={k.meanCertainty == null ? "—" : k.meanCertainty.toFixed(2)} />
        <Kpi label="Commentaires" value={String(k.comments)} />
        <Kpi label="Contributeurs" value={String(k.contributors)} />
        <Kpi label="Accord LLM" value={k.agreementWithLlm == null ? "—" : `${Math.round(k.agreementWithLlm * 100)}%`} />
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
            Certitude par clause
          </h2>
          <Panel className="p-3">
            <ul className="flex flex-col gap-1 text-xs" data-testid="clause-certainty">
              {data.clauseCertainty.map((c) => {
                const t = getThemeToken(c.theme);
                const cert = getCertaintyToken(c.certainty ?? 0);
                return (
                  <li key={c.anchorIndex} className="flex items-center gap-2">
                    <span className="font-mono text-ink-muted">@{c.anchorIndex}</span>
                    <span className="flex items-center gap-1 text-ink">
                      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.label}
                    </span>
                    <span className="ml-auto" title={cert.label}>
                      {cert.emoji} {c.certainty ?? "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Remarques (qualification du document)
      </h2>
      <Panel className="p-3">
        <ul className="mb-3 flex flex-col gap-2" data-testid="remarks-list">
          {remarks.length === 0 && (
            <li className="text-xs text-ink-muted">Aucune remarque pour ce document.</li>
          )}
          {remarks.map((c) => (
            <li key={c.id} className="rounded-md border border-line bg-panel-muted/40 p-2 text-sm">
              <span className="font-medium text-ink">{c.authorId}</span>
              <p className="text-ink-muted">{c.body}</p>
            </li>
          ))}
        </ul>
        <textarea
          data-testid="remark-body"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          rows={2}
          placeholder="Laisser une remarque sur la qualité d'annotation de ce document…"
          className="mb-1 w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink"
        />
        <button
          type="button"
          data-testid="remark-add"
          disabled={!remark.trim() || !annotationId}
          onClick={() => {
            addComment.mutate({ body: remark.trim(), scope: "document" });
            setRemark("");
          }}
          className="rounded-md bg-accent/20 px-3 py-1 text-xs font-medium text-ink hover:bg-accent/30 disabled:opacity-40"
        >
          Ajouter la remarque
        </button>
      </Panel>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="p-3 text-center">
      <div className="text-2xl font-semibold text-ink">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</div>
    </Panel>
  );
}
