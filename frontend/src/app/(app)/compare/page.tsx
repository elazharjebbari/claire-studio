"use client";

/** Comparaison côte-à-côte (humain vs LLM) + diff (navigation.md §1). */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAnnotation, usePreAnnotations } from "@/lib/api/hooks";
import { preClausesToPivot } from "@/lib/pivot";
import { Panel } from "@/components/ui/primitives";
import { ClauseChip } from "@/components/ui/ClauseChip";

function CompareInner() {
  const sp = useSearchParams();
  const docTitle = sp.get("doc") ?? "—";
  // Paramètres réels passés dans l'URL : ?a=<annotationId>&project=<slug>&document=<id>
  const annotationId = sp.get("a") ?? undefined;
  const projectSlug = sp.get("project") ?? "claudette-gold-v1";
  const documentId = sp.get("document") ?? undefined;
  const { data: annotation } = useAnnotation(annotationId);
  const { data: pre } = usePreAnnotations(projectSlug, documentId);
  const claude = pre?.results.find((p) => p.judge === "claude");

  if (!annotationId || !documentId) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-3 text-xl font-semibold text-ink">Comparaison</h1>
        <Panel className="p-6 text-sm text-ink-muted">
          Sélectionnez une annotation et un document à comparer.{" "}
          <a href="/projects" className="text-accent hover:underline">
            Ouvrir un projet →
          </a>
          <p className="mt-2 text-xs">
            URL attendue : <code>/compare?a=&lt;annotationId&gt;&amp;document=&lt;documentId&gt;&amp;doc=&lt;titre&gt;</code>
          </p>
        </Panel>
      </div>
    );
  }
  const human = new Map((annotation?.clauses ?? []).map((c) => [c.anchorIndex, c.theme]));
  const llm = new Map(preClausesToPivot(claude?.clauses ?? []).map((c) => [c.anchor_index, c.theme]));
  const allAnchors = Array.from(new Set([...human.keys(), ...llm.keys()])).sort((a, b) => a - b);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-4 text-xl font-semibold text-ink">
        Comparaison · {docTitle} — humain vs claude
      </h1>
      <Panel className="overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_1fr] border-b border-line bg-panel-muted text-xs font-semibold uppercase text-ink-muted">
          <div className="p-2">Ancre</div>
          <div className="p-2">Humain</div>
          <div className="p-2">Claude</div>
        </div>
        {allAnchors.map((a) => {
          const h = human.get(a);
          const l = llm.get(a);
          const diff = h !== l;
          return (
            <div
              key={a}
              data-testid={`compare-row-${a}`}
              className={`grid grid-cols-[60px_1fr_1fr] border-b border-line ${
                diff ? "bg-amber-500/5" : ""
              }`}
            >
              <div className="p-2 font-mono text-xs text-ink-muted">[{a}]</div>
              <div className="p-2">{h ? <ClauseChip themeCode={h} size="sm" /> : <span className="text-ink-muted">—</span>}</div>
              <div className="p-2">{l ? <ClauseChip themeCode={l} size="sm" ghost={diff} /> : <span className="text-ink-muted">—</span>}</div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-ink-muted">Chargement…</div>}>
      <CompareInner />
    </Suspense>
  );
}
