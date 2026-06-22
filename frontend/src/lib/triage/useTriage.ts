"use client";

/**
 * useTriage — pont RÉACTIF entre le moteur de triage (pur) et les données live des juges.
 *
 * Pour chaque phrase du document, calcule, à partir des pré-annotations N-juges
 * (`preByJudge`), le vote de thème (thème de la clause du juge couvrant la phrase,
 * forward-fill) et le vote de frontière (`is_block_start` = le juge a-t-il une ancre ici),
 * puis exécute `triageEngine`. Tout est dérivé CÔTÉ CLIENT (zéro round-trip) → recalcul
 * instantané au changement de version/juges. `buildTriageItems` est PUR (testable).
 */

import { useMemo } from "react";

import { useLlmAgreement } from "@/lib/api/hooks";
import type { PreAnnotation } from "@/types/contract";
import { RULES, triageEngine, type TriageLevel, type TriageResult } from ".";

export interface TriageItem {
  index: number;
  /** null si moins de `minJudges` juges couvrent la phrase. */
  result: TriageResult | null;
}

export interface TriageData {
  items: TriageItem[];
  byIndex: Record<number, TriageResult | null>;
  summary: Record<TriageLevel, number>;
  /** Indices triables (result non null), regroupés par niveau, dans l'ordre du document. */
  byLevel: Record<TriageLevel, number[]>;
  /** Vrai si assez de juges sont présents pour trier (≥ minJudges). */
  ready: boolean;
  judgeCount: number;
}

const LEVELS: TriageLevel[] = ["C1", "C2", "C3", "C4", "C5"];

/** PUR : construit l'item de triage de chaque phrase 0..n-1 depuis les juges. */
export function buildTriageItems(
  preByJudge: Record<string, PreAnnotation>,
  n: number,
): TriageItem[] {
  const perJudge = Object.keys(preByJudge).map((j) => {
    const clauses = [...(preByJudge[j]?.clauses ?? [])].sort(
      (a, b) => a.anchorIndex - b.anchorIndex,
    );
    return { j, clauses, starts: new Set(clauses.map((c) => c.anchorIndex)) };
  });

  const themeAt = (clauses: { anchorIndex: number; themeCode: string }[], i: number) => {
    let theme: string | undefined;
    for (const c of clauses) {
      if (c.anchorIndex <= i) theme = c.themeCode;
      else break;
    }
    return theme;
  };

  const items: TriageItem[] = [];
  for (let i = 0; i < n; i++) {
    const themeVotes: Record<string, string> = {};
    const boundaryVotes: Record<string, boolean> = {};
    for (const pj of perJudge) {
      const t = themeAt(pj.clauses, i);
      if (t !== undefined) {
        themeVotes[pj.j] = t;
        boundaryVotes[pj.j] = pj.starts.has(i);
      }
    }
    items.push({ index: i, result: triageEngine(themeVotes, boundaryVotes, RULES) });
  }
  return items;
}

/** Hook réactif : recalcule le triage du document à chaque changement de version/juges. */
export function useTriage(
  documentId?: string,
  projectSlug?: string,
  version?: string | null,
): TriageData {
  const llm = useLlmAgreement(documentId, projectSlug, version);
  return useMemo(() => {
    const preByJudge = (llm.preByJudge ?? {}) as Record<string, PreAnnotation>;
    const n = llm.nSentences ?? 0;
    const items = buildTriageItems(preByJudge, n);
    const byIndex: Record<number, TriageResult | null> = {};
    const summary = { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0 } as Record<TriageLevel, number>;
    const byLevel = { C1: [], C2: [], C3: [], C4: [], C5: [] } as Record<TriageLevel, number[]>;
    for (const it of items) {
      byIndex[it.index] = it.result;
      if (it.result) {
        summary[it.result.level] += 1;
        byLevel[it.result.level].push(it.index);
      }
    }
    const judgeCount = Object.keys(preByJudge).length;
    return {
      items,
      byIndex,
      summary,
      byLevel,
      ready: judgeCount >= RULES.thresholds.minJudges,
      judgeCount,
    };
  }, [llm.preByJudge, llm.nSentences]);
}

export { LEVELS as TRIAGE_LEVELS };
