"use client";

/**
 * ConcordancePanel (point 4) — encart KPI de concordance sur le tableau de bord projet.
 * Affiche, pour MA session sur la campagne : l'accord de mon annotation avec chaque
 * modèle LLM (barres + meilleur modèle), et l'accord entre modèles (LLM↔LLM). Données
 * agrégées côté serveur (endpoint progress) — pas de calcul lourd côté client.
 */

import { GitCompare, Trophy } from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import { llmJudgeLabel, llmJudgeColor } from "@/lib/llmJudges";
import type { ProjectConcordance } from "@/types/contract";

function pctLabel(pct: number | null | undefined): string {
  return pct == null ? "—" : `${Math.round(pct)}%`;
}

export function ConcordancePanel({ data }: { data: ProjectConcordance }) {
  const best = data.bestMatch ?? null;
  const hasRows = data.perJudge.length > 0;

  return (
    <Panel className="p-4" data-testid="concordance-panel">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-semibold text-ink">
          <GitCompare size={16} aria-hidden className="text-accent" /> Concordance avec les modèles
        </h2>
        {best && (
          <span
            data-testid="concordance-panel-best"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-300"
          >
            <Trophy size={12} aria-hidden /> {llmJudgeLabel(best.judge)} · {pctLabel(best.pct)}
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-ink-muted">
        Accord de <strong className="text-ink">votre annotation</strong> avec chaque modèle,
        sur vos {data.documentsCompared} document{data.documentsCompared > 1 ? "s" : ""} (phrases
        co-annotées).
      </p>

      {hasRows ? (
        <ul className="flex flex-col gap-2" data-testid="concordance-panel-rows">
          {data.perJudge.map((p) => {
            const isBest = best?.judge === p.judge && p.pct != null;
            return (
              <li key={p.judge} className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: llmJudgeColor(p.judge) }}
                />
                <span className="w-20 shrink-0 truncate text-sm text-ink">
                  {llmJudgeLabel(p.judge)}
                </span>
                <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-panel-muted">
                  <span
                    className={"absolute inset-y-0 left-0 rounded-full " + (isBest ? "bg-emerald-400" : "bg-accent")}
                    style={{ width: `${p.pct ?? 0}%` }}
                    aria-hidden
                  />
                </span>
                <span className="flex w-16 shrink-0 items-center justify-end gap-1 font-mono text-xs text-ink">
                  {isBest && <Trophy size={12} aria-hidden className="text-emerald-300" />}
                  {pctLabel(p.pct)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">Aucun modèle à comparer sur vos documents.</p>
      )}

      {data.llmPairs.length > 0 && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wide text-ink-muted">
              Entre modèles (LLM ↔ LLM)
            </span>
            <span className="font-mono text-ink" data-testid="concordance-panel-llm-mean">
              {pctLabel(data.llmMeanPct)} moy.
            </span>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            {data.llmPairs.map((pair) => (
              <li key={`${pair.a}-${pair.b}`} className="flex items-center gap-1.5">
                <span>
                  {llmJudgeLabel(pair.a)} · {llmJudgeLabel(pair.b)}
                </span>
                <span className="font-mono text-ink">{pctLabel(pair.pct)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
