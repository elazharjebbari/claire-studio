"use client";

/**
 * ConcordanceWidget (point 4) — KPIs de concordance EN TEMPS RÉEL dans l'atelier.
 *
 * Placement non intrusif : une petite pastille dans le cluster de statut de la barre
 * d'outils, qui affiche le modèle le plus concordant + le %. Au clic, elle déplie une
 * carte détaillée : accord de l'annotateur avec CHAQUE modèle (barres) + accord entre
 * modèles (LLM↔LLM). Tout est recalculé côté client à chaque changement d'annotation
 * (les clauses du brouillon sont la source vivante) — zéro round-trip.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { GitCompare, Trophy, X } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace";
import { useLlmAgreement } from "@/lib/api/hooks";
import { llmJudgeLabel, llmJudgeColor } from "@/lib/llmJudges";
import {
  themeVectorExact,
  judgeVectorsFromPre,
  concordanceReport,
} from "@/lib/concordance";

function pctLabel(pct: number | null): string {
  return pct == null ? "—" : `${Math.round(pct)}%`;
}

export function ConcordanceWidget({
  documentId,
  projectSlug,
}: {
  documentId: string;
  projectSlug: string;
}) {
  const draftClauses = useWorkspaceStore((s) => s.draftClauses);
  const nSentences = useWorkspaceStore((s) => s.nSentences);
  const llm = useLlmAgreement(documentId, projectSlug);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const report = useMemo(() => {
    const human = themeVectorExact(
      draftClauses.map((c) => ({ anchorIndex: c.anchorIndex, theme: c.theme })),
      nSentences,
    );
    const judgeVecs = judgeVectorsFromPre(llm.preByJudge ?? {}, nSentences);
    return concordanceReport(human, judgeVecs);
  }, [draftClauses, nSentences, llm.preByJudge]);

  // Fermeture : clic en dehors / Échap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const judgeCount = report.perJudge.length;
  // Sans juge pour ce document, le widget n'a rien à dire → on s'efface.
  if (judgeCount === 0) return null;

  const best = report.bestMatch;
  const noCoverage = report.humanCovered === 0;

  return (
    <div ref={rootRef} className="relative" data-testid="concordance-widget">
      <button
        type="button"
        data-testid="concordance-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Concordance avec les modèles LLM (cliquez pour le détail)"
        className={
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors " +
          (open
            ? "border-accent/40 bg-accent/10 text-ink"
            : "border-line text-ink-muted hover:bg-panel-muted hover:text-ink")
        }
      >
        <GitCompare size={13} aria-hidden />
        {noCoverage || !best ? (
          <span>Concordance</span>
        ) : (
          <span data-testid="concordance-best">
            {llmJudgeLabel(best.judge)} <span className="font-mono text-ink">{pctLabel(best.pct)}</span>
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Détail de la concordance"
          data-testid="concordance-card"
          className="absolute right-0 top-full z-50 mt-1.5 w-80 rounded-lg border border-line bg-elevated p-3 text-left shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <GitCompare size={14} aria-hidden className="text-accent" /> Concordance
            </h3>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-ink-muted hover:bg-panel-muted hover:text-ink"
            >
              <X size={14} aria-hidden />
            </button>
          </div>

          <p className="mb-2.5 text-[11px] leading-snug text-ink-muted">
            Accord de <strong className="text-ink">votre annotation</strong> avec chaque
            modèle, sur les phrases que vous avez déjà annotées.
          </p>

          {noCoverage ? (
            <p
              data-testid="concordance-empty"
              className="rounded-md border border-dashed border-line p-2.5 text-[11px] text-ink-muted"
            >
              Annotez au moins une phrase pour voir votre accord avec les modèles.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5" data-testid="concordance-rows">
              {report.perJudge.map((p) => {
                const isBest = best?.judge === p.judge && p.pct != null;
                return (
                  <li key={p.judge} className="flex items-center gap-2" data-testid={`concordance-row-${p.judge}`}>
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: llmJudgeColor(p.judge) }}
                    />
                    <span className="w-16 shrink-0 truncate text-xs text-ink">
                      {llmJudgeLabel(p.judge)}
                    </span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-panel-muted">
                      <span
                        className={"absolute inset-y-0 left-0 rounded-full " + (isBest ? "bg-emerald-400" : "bg-accent")}
                        style={{ width: `${p.pct ?? 0}%` }}
                        aria-hidden
                      />
                    </span>
                    <span className="flex w-14 shrink-0 items-center justify-end gap-1 font-mono text-[11px] text-ink">
                      {isBest && <Trophy size={11} aria-hidden className="text-emerald-300" />}
                      {pctLabel(p.pct)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Accord entre modèles (LLM↔LLM). */}
          {report.llmPairs.length > 0 && (
            <div className="mt-3 border-t border-line/60 pt-2.5">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-semibold uppercase tracking-wide text-ink-muted">
                  Entre modèles
                </span>
                <span className="font-mono text-ink" data-testid="concordance-llm-mean">
                  {pctLabel(report.llmMeanPct)} moy.
                </span>
              </div>
              <ul className="flex flex-col gap-0.5">
                {report.llmPairs.map((pair) => (
                  <li
                    key={`${pair.a}-${pair.b}`}
                    className="flex items-center justify-between text-[11px] text-ink-muted"
                  >
                    <span>
                      {llmJudgeLabel(pair.a)} · {llmJudgeLabel(pair.b)}
                    </span>
                    <span className="font-mono text-ink">{pctLabel(pair.pct)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-2.5 text-[10px] text-ink-muted" data-testid="concordance-coverage">
            Couverture : {report.humanCovered}/{nSentences} phrases annotées.
          </p>
        </div>
      )}
    </div>
  );
}
