/**
 * Pure logic of the reviewer demo: input guards, thematic segments, disagreements, exports.
 * No React, no network — everything here is unit-tested.
 */

import type { DemoComparison, DemoPrediction, DemoResult } from "@/lib/api/demo";
import { projectTheme, type TaxonomyId } from "@/lib/taxonomy";

export const MAX_CHARS = 60000;
export const MAX_FILE_BYTES = 200 * 1024;
export const MIN_ENGLISH_SHARE = 0.05;

const STOPWORDS = new Set(
  `the of and to in a is that for you or by with as be on this any are your not will may shall from at if we our all such other its use terms which these can under have has without including between provided agree service services account`.split(
    " ",
  ),
);

/** Share of English function words among the first 2,000 characters (same rule as the API). */
export function englishShare(text: string): number {
  const tokens = text.slice(0, 2000).toLowerCase().match(/[a-z']+/g) ?? [];
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const t of tokens) if (STOPWORDS.has(t)) hits += 1;
  return hits / tokens.length;
}

export function looksEnglish(text: string): boolean {
  return englishShare(text) >= MIN_ENGLISH_SHARE;
}

/** Rough sentence count for the live counter (the server segments for real). */
export function estimateSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const lines = trimmed.split(/\n+/).filter((l) => l.trim());
  let n = 0;
  for (const line of lines) n += Math.max(1, (line.match(/[.!?;](\s|$)/g) ?? []).length);
  return n;
}

export type InputProblem = "empty" | "too_long" | "not_english" | null;

export function inputProblem(text: string, maxChars = MAX_CHARS): InputProblem {
  if (!text.trim()) return "empty";
  if (text.length > maxChars) return "too_long";
  if (!looksEnglish(text)) return "not_english";
  return null;
}

export interface Segment {
  label: string;
  start: number;
  end: number;
  count: number;
}

/** Maximal runs of consecutive sentences sharing the predicted label (clause boundaries). */
export function segments(predictions: DemoPrediction[]): Segment[] {
  const out: Segment[] = [];
  for (const p of predictions) {
    const last = out[out.length - 1];
    if (last && last.label === p.label && last.end === p.index - 1) {
      last.end = p.index;
      last.count += 1;
    } else {
      out.push({ label: p.label, start: p.index, end: p.index, count: 1 });
    }
  }
  return out;
}

export function labelCounts(predictions: DemoPrediction[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of predictions) counts.set(p.label, (counts.get(p.label) ?? 0) + 1);
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export function medianConfidence(predictions: DemoPrediction[]): number | null {
  if (predictions.length === 0) return null;
  const sorted = predictions.map((p) => p.confidence).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Project a canonical T20 code into the reading taxonomy (T20 stays as is). */
export function project(code: string | null | undefined, taxonomy: TaxonomyId): string | null {
  if (!code) return null;
  if (taxonomy === "T20") return code;
  return projectTheme(code, taxonomy);
}

export interface ComparisonRow {
  index: number;
  gold: string | null;
  goldT20: string | null;
  agreementClass: string | null;
  tier: string | null;
  votes: Record<string, string | null>;
  judges: Record<string, string | null>;
}

const ANNOTATORS = ["A1", "A2", "A3"];

/** Index the comparison payload by sentence, projected into `taxonomy` for display. */
export function comparisonRows(comparison: DemoComparison, taxonomy: TaxonomyId, judgeIds: string[]): Map<number, ComparisonRow> {
  const rows = new Map<number, ComparisonRow>();
  const votesByIndex = new Map(comparison.votes.map((v) => [Number(v.index), v]));
  const judgesByIndex = new Map(comparison.judges.map((j) => [Number(j.index), j]));
  for (const g of comparison.gold) {
    const v = votesByIndex.get(g.index) ?? {};
    const j = judgesByIndex.get(g.index) ?? {};
    const votes: Record<string, string | null> = {};
    for (const a of ANNOTATORS) votes[a] = project((v[a] as string | null) ?? null, taxonomy);
    const judges: Record<string, string | null> = {};
    for (const id of judgeIds) judges[id] = project((j[id] as string | null) ?? null, taxonomy);
    rows.set(g.index, {
      index: g.index,
      gold: taxonomy === "T20" ? g.primaryT20 : g.primaryT11,
      goldT20: g.primaryT20,
      agreementClass: g.agreementClass,
      tier: g.tier,
      votes,
      judges,
    });
  }
  return rows;
}

/** A sentence is a disagreement when the model differs from the gold, or the annotators split. */
export function isDisagreement(prediction: DemoPrediction, row: ComparisonRow | undefined, taxonomy: TaxonomyId): boolean {
  if (!row) return false;
  const model = taxonomy === "T20" ? prediction.label : prediction.label; // model predicts T11 codes
  if (row.gold && model !== row.gold && taxonomy !== "T20") return true;
  const votes = Object.values(row.votes).filter(Boolean);
  return new Set(votes).size > 1;
}

// --------------------------------------------------------------------------- exports

export interface ExportOptions {
  includeText: boolean;
  title: string;
}

export function toExportRows(result: DemoResult, options: ExportOptions) {
  const comparison = result.comparison ?? null;
  const goldByIndex = new Map((comparison?.gold ?? []).map((g) => [g.index, g]));
  return result.sentences.map((s) => ({
    index: s.index,
    ...(options.includeText ? { text: s.text } : {}),
    predicted: s.label,
    confidence: s.confidence,
    ...(comparison
      ? { goldT20: goldByIndex.get(s.index)?.primaryT20 ?? null, goldT11: goldByIndex.get(s.index)?.primaryT11 ?? null }
      : {}),
  }));
}

export function toJsonExport(result: DemoResult, options: ExportOptions): string {
  return JSON.stringify(
    {
      title: options.title,
      textIncluded: options.includeText,
      note: options.includeText ? undefined : "Sentence text omitted (CLAUDETTE licence); records are keyed by index.",
      segmenter: result.segmenter,
      summary: result.comparison?.summary ?? null,
      sentences: toExportRows(result, options),
    },
    null,
    2,
  );
}

export function toCsvExport(result: DemoResult, options: ExportOptions): string {
  const rows = toExportRows(result, options);
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => escape((r as Record<string, unknown>)[c])).join(","))].join("\n");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatNumber(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}
