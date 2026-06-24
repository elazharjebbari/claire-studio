/**
 * Agrégats PURS du cockpit GOLD (testables sans React).
 */
import type { GoldDocumentRow } from "./types";

export interface CockpitSummary {
  total: number;
  resolved: number;
  inProgress: number;
  unresolved: number;
  sentencesTotal: number;
  sentencesDecided: number;
  pctOverall: number; // ∈ [0,1]
  highRisk: number; // phrases à risque élevé restantes (tous documents)
}

export function summarize(rows: GoldDocumentRow[]): CockpitSummary {
  let resolved = 0;
  let inProgress = 0;
  let unresolved = 0;
  let sentencesTotal = 0;
  let sentencesDecided = 0;
  let highRisk = 0;
  for (const r of rows) {
    if (r.status === "resolved") resolved++;
    else if (r.status === "in_progress") inProgress++;
    else unresolved++;
    sentencesTotal += r.document.nSentences ?? 0;
    sentencesDecided += r.counts.decided ?? 0;
    highRisk += r.counts.highRisk ?? 0;
  }
  return {
    total: rows.length,
    resolved,
    inProgress,
    unresolved,
    sentencesTotal,
    sentencesDecided,
    pctOverall: sentencesTotal > 0 ? sentencesDecided / sentencesTotal : 0,
    highRisk,
  };
}
