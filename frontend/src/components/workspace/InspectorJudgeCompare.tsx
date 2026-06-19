"use client";

/**
 * InspectorJudgeCompare — sous l'evidence span + rationale, permet de COMPARER la
 * proposition de chaque source pour la clause sélectionnée : « Vous » (annotation
 * humaine courante), « Claude », « Codex ». Pour un juge, affiche son evidence span
 * et son rationale (lecture seule) + un bouton « Reprendre » qui recopie ces valeurs
 * dans votre annotation (arbitrage rapide). Données via useLlmAgreement (version
 * courante). N annotateurs humains : prévu via /contributors (étape suivante).
 */

import { useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { useLlmAgreement } from "@/lib/api/hooks";
import type { PreClause } from "@/types/contract";

type Source = "human" | "claude" | "codex";

/** Clause du juge couvrant l'ancre : dernière clause d'ancre <= anchorIndex. */
function coveringClause(clauses: PreClause[] | undefined, anchorIndex: number): PreClause | null {
  if (!clauses?.length) return null;
  const sorted = [...clauses].sort((a, b) => a.anchorIndex - b.anchorIndex);
  let found: PreClause | null = null;
  for (const c of sorted) {
    if (c.anchorIndex <= anchorIndex) found = c;
    else break;
  }
  return found ?? sorted[0]!;
}

export function InspectorJudgeCompare({
  documentId,
  projectSlug,
  anchorIndex,
  draftLocalId,
  humanEvidence,
  humanRationale,
}: {
  documentId?: string;
  projectSlug?: string;
  anchorIndex: number;
  draftLocalId: string;
  humanEvidence: string;
  humanRationale: string;
}) {
  const llmVersion = useWorkspaceStore((s) => s.llmVersion);
  const updateDraft = useWorkspaceStore((s) => s.updateDraft);
  const llm = useLlmAgreement(documentId, projectSlug, llmVersion);
  const [source, setSource] = useState<Source>("human");

  const claude = coveringClause(llm.claudePre?.clauses, anchorIndex);
  const codex = coveringClause(llm.codexPre?.clauses, anchorIndex);

  const OPTIONS: { value: Source; label: string; enabled: boolean }[] = [
    { value: "human", label: "Vous", enabled: true },
    { value: "claude", label: "Claude", enabled: Boolean(claude) },
    { value: "codex", label: "Codex", enabled: Boolean(codex) },
  ];

  const judge = source === "claude" ? claude : source === "codex" ? codex : null;
  const evidence = source === "human" ? humanEvidence : judge?.evidenceSpan ?? "";
  const rationale = source === "human" ? humanRationale : judge?.rationale ?? "";

  return (
    <div className="rounded-md border border-line bg-panel-muted/30 p-2" data-testid="inspector-source-compare">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Comparer la source
        </span>
        <div role="radiogroup" aria-label="Source evidence/rationale" className="flex gap-1">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={source === o.value}
              disabled={!o.enabled}
              data-testid={`inspector-source-${o.value}`}
              onClick={() => setSource(o.value)}
              className={
                "rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-40 " +
                (source === o.value
                  ? "bg-accent/15 text-ink ring-1 ring-accent/40"
                  : "text-ink-muted hover:bg-panel-muted")
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {source === "human" ? (
        <p className="text-[11px] text-ink-muted">
          Votre evidence span et votre rationale sont éditables ci-dessus. Choisissez
          Claude ou Codex pour comparer et reprendre leur proposition.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5 text-xs" data-testid="inspector-source-content">
          <div>
            <span className="text-[10px] uppercase text-ink-muted">Evidence</span>
            <p className="border-l-2 border-line pl-2 italic text-ink-muted">
              {evidence ? `« ${evidence} »` : "—"}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-ink-muted">Rationale</span>
            <p className="text-ink-muted">{rationale || "—"}</p>
          </div>
          <button
            type="button"
            data-testid="inspector-source-adopt"
            disabled={!evidence && !rationale}
            onClick={() =>
              updateDraft(draftLocalId, {
                evidenceSpan: evidence || humanEvidence,
                rationale: rationale || humanRationale,
              })
            }
            className="mt-0.5 self-start rounded border border-line px-2 py-0.5 text-[11px] font-medium text-ink hover:bg-panel-muted disabled:opacity-40"
          >
            Reprendre dans mon annotation
          </button>
        </div>
      )}
    </div>
  );
}
