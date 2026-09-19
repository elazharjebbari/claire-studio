"use client";

/**
 * Read-only viewer in the visual language of the annotation workshop: one row per sentence,
 * a colour rail for the predicted theme, clause boundaries where the theme changes, a sticky
 * side rail with contents (thematic segments) and a legend. For a held-out CLAUDETTE contract,
 * extra columns show the gold standard, the three annotators (A1–A3) and the four judges, plus
 * a summary (accuracy and Cohen's κ against the gold).
 */

import { useMemo, useState } from "react";
import { Download, Filter, X } from "lucide-react";

import { Button, Panel } from "@/components/ui/primitives";
import type { DemoJob } from "@/lib/api/demo";
import type { TaxonomyId } from "@/lib/taxonomy";
import { themeLabelEn } from "@/lib/taxonomy/labels.en";
import {
  comparisonRows,
  formatNumber,
  isDisagreement,
  labelCounts,
  medianConfidence,
  segments,
  toCsvExport,
  toJsonExport,
  type ComparisonRow,
} from "./logic";
import { ThemeChip, themeColor } from "./ThemeChip";

const ANNOTATORS = ["A1", "A2", "A3"];

export interface ResultsViewerProps {
  job: DemoJob;
  judgeIds: string[];
  onClose?: () => void;
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResultsViewer({ job, judgeIds, onClose }: ResultsViewerProps) {
  const result = job.result!;
  const isContract = job.source === "contract" && !!result.comparison;
  const [taxonomy, setTaxonomy] = useState<TaxonomyId>("T11");
  const [onlyDisagreements, setOnlyDisagreements] = useState(false);

  const segs = useMemo(() => segments(result.sentences), [result.sentences]);
  const counts = useMemo(() => labelCounts(result.sentences), [result.sentences]);
  const rows = useMemo(
    () => (result.comparison ? comparisonRows(result.comparison, taxonomy, judgeIds) : new Map<number, ComparisonRow>()),
    [result.comparison, taxonomy, judgeIds],
  );
  const visible = useMemo(
    () => (onlyDisagreements && isContract ? result.sentences.filter((s) => isDisagreement(s, rows.get(s.index), taxonomy)) : result.sentences),
    [onlyDisagreements, isContract, result.sentences, rows, taxonomy],
  );
  const summary = result.comparison?.summary;
  const legend = result.comparison?.judgesLegend ?? {};
  const title = isContract ? `${job.document} (CLAUDETTE, held out)` : job.title || "Pasted text";
  const median = medianConfidence(result.sentences);

  return (
    <section aria-labelledby="demo-result-title" data-testid="demo-result" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="demo-result-title" className="font-display text-xl text-ink">
            Result — {title}
          </h3>
          <p role="status" className="mt-1 text-sm text-ink-muted" data-testid="demo-summary">
            {isContract && summary ? (
              <>
                Accuracy against the gold standard <strong className="text-ink">{formatNumber(summary.accuracyT11, 2)}</strong>
                {" · "}Cohen&apos;s κ <strong className="text-ink">{formatNumber(summary.kappaT11, 2)}</strong>
                {" · "}{summary.nSentences} sentences
                {" · "}Judges:{" "}
                {judgeIds
                  .map((j) => `${legend[j] ?? j} ${formatNumber(summary.judgesAccuracyT11[j], 2)}`)
                  .join(", ")}
              </>
            ) : (
              <>
                {result.sentences.length} sentences · {segs.length} thematic segments · median confidence {formatNumber(median, 2)}
                {result.segmenter ? ` · segmented by ${result.segmenter}` : ""}
              </>
            )}
            {result.truncated ? " · Only the first 400 sentences were classified." : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            icon={<Download size={14} aria-hidden />}
            onClick={() => download("pactiva-result.json", toJsonExport(result, { includeText: !isContract, title }), "application/json")}
          >
            Export JSON
          </Button>
          <Button
            size="sm"
            icon={<Download size={14} aria-hidden />}
            onClick={() => download("pactiva-result.csv", toCsvExport(result, { includeText: !isContract, title }), "text/csv")}
          >
            Export CSV
          </Button>
          {onClose && (
            <Button size="sm" variant="ghost" icon={<X size={14} aria-hidden />} onClick={onClose} aria-label="Close the result">
              Close
            </Button>
          )}
        </div>
      </div>
      {isContract && <p className="text-[12px] text-ink-muted">Exports omit the sentence text (CLAUDETTE licence).</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        {/* Document pane */}
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-panel-muted px-3 py-2 text-[12px] text-ink-muted">
            <div className="flex items-center gap-4">
              <span className="w-8 text-right">#</span>
              <span>Sentence</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-36">Model</span>
              {isContract && (
                <>
                  <span className="w-12 text-center">Gold</span>
                  <span className="w-16 text-center">A1 A2 A3</span>
                  <span className="w-20 text-center">Judges</span>
                </>
              )}
            </div>
          </div>
          <ol className="max-h-[70vh] overflow-y-auto" data-testid="demo-sentences">
            {visible.map((s, i) => {
              const prev = visible[i - 1];
              const boundary = !prev || prev.label !== s.label || prev.index !== s.index - 1;
              const row = rows.get(s.index);
              const color = themeColor(s.label, "T11");
              return (
                <li key={s.index} className="border-b border-line/60 last:border-b-0">
                  {boundary && (
                    <div
                      className="flex items-center gap-2 px-3 pt-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted"
                      data-testid="demo-boundary"
                      aria-hidden
                    >
                      <span className="h-px flex-1" style={{ backgroundColor: `${color}66` }} />
                      <span style={{ color }}>{themeLabelEn(s.label)}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-3 px-3 py-2" tabIndex={0} data-testid="demo-sentence-row">
                    <span className="w-8 shrink-0 pt-0.5 text-right font-mono text-[11px] text-ink-muted">{s.index}</span>
                    <span className="w-1 shrink-0 self-stretch rounded-full" style={{ backgroundColor: color }} aria-hidden />
                    <p className="min-w-0 flex-1 font-reading text-[15px] leading-reading text-ink">{s.text}</p>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="flex w-36 flex-col gap-1">
                        <ThemeChip code={s.label} taxonomy="T11" testId={`demo-pred-${s.index}`} />
                        <span className="flex items-center gap-1 text-[11px] text-ink-muted" title={`confidence ${formatNumber(s.confidence, 3)}`}>
                          <span className="h-1 w-16 overflow-hidden rounded-full bg-panel-muted" aria-hidden>
                            <span className="block h-full" style={{ width: `${Math.round(s.confidence * 100)}%`, backgroundColor: color }} />
                          </span>
                          {formatNumber(s.confidence, 2)}
                        </span>
                      </div>
                      {isContract && (
                        <>
                          <span className="flex w-12 justify-center">
                            <ThemeChip code={row?.gold ?? null} taxonomy={taxonomy} variant="dot" differs={!!row?.gold && taxonomy === "T11" && row.gold !== s.label} testId={`demo-gold-${s.index}`} />
                          </span>
                          <span className="flex w-16 justify-center gap-1">
                            {ANNOTATORS.map((a) => (
                              <ThemeChip key={a} code={row?.votes[a] ?? null} taxonomy={taxonomy} variant="dot" differs={!!row?.votes[a] && !!row?.gold && row.votes[a] !== row.gold} />
                            ))}
                          </span>
                          <span className="flex w-20 justify-center gap-1">
                            {judgeIds.map((j) => (
                              <ThemeChip key={j} code={row?.judges[j] ?? null} taxonomy={taxonomy} variant="dot" differs={!!row?.judges[j] && !!row?.gold && row.judges[j] !== row.gold} />
                            ))}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
            {visible.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-muted">No disagreement on this document.</li>}
          </ol>
        </Panel>

        {/* Side rail */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <Panel className="p-3">
            <h4 className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Contents</h4>
            <ol className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto text-[13px]" data-testid="demo-toc">
              {segs.map((seg) => (
                <li key={`${seg.start}-${seg.label}`}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-panel-muted"
                    onClick={() => document.querySelector(`[data-testid="demo-pred-${seg.start}"]`)?.closest("li")?.scrollIntoView({ block: "start" })}
                  >
                    <span className="h-3 w-1 rounded-full" style={{ backgroundColor: themeColor(seg.label, "T11") }} aria-hidden />
                    <span className="flex-1 truncate text-ink">{themeLabelEn(seg.label)}</span>
                    <span className="font-mono text-[11px] text-ink-muted">{seg.start === seg.end ? seg.start : `${seg.start}–${seg.end}`}</span>
                  </button>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel className="p-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Legend</h4>
              {isContract && (
                <div role="group" aria-label="Taxonomy for the reference columns" className="flex rounded-md border border-line text-[11px]">
                  {(["T11", "T20"] as TaxonomyId[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={taxonomy === t}
                      data-testid={`demo-taxonomy-${t}`}
                      onClick={() => setTaxonomy(t)}
                      className={`px-2 py-0.5 ${taxonomy === t ? "bg-accent text-accent-fg" : "text-ink-muted hover:text-ink"}`}
                    >
                      {t === "T11" ? "11 themes" : "20 themes"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-[13px]">
              {counts.map((c) => (
                <li key={c.label} className="flex items-center justify-between gap-2">
                  <ThemeChip code={c.label} taxonomy="T11" />
                  <span className="font-mono text-[11px] text-ink-muted">{c.count}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-ink-muted">Colours follow the annotation workshop; the label is always shown.</p>
            {isContract && (
              <p className="mt-1 text-[11px] text-ink-muted">
                Reference columns: gold, annotators A1–A3, judges {judgeIds.map((j) => legend[j] ?? j).join(" · ")}. A ≠ marks a cell that differs from the gold.
              </p>
            )}
          </Panel>

          {isContract && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={onlyDisagreements}
                onChange={(e) => setOnlyDisagreements(e.target.checked)}
                data-testid="demo-disagreements"
                className="h-4 w-4 accent-[rgb(var(--surface-accent))]"
              />
              <Filter size={14} aria-hidden />
              Show disagreements only
            </label>
          )}
        </aside>
      </div>
    </section>
  );
}
