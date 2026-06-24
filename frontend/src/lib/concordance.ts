/**
 * Concordance (point 4) — calcul PUR (sans React) des KPIs d'accord entre l'annotateur
 * humain et chaque juge LLM, ainsi qu'entre les LLM eux-mêmes. Brique testée isolément.
 *
 * Modèles (cohérents avec le backend IAA et le triage) :
 *  - HUMAIN : per-sentence EXACT (C4) — la phrase *i* porte le thème de la clause ancrée
 *    EXACTEMENT en *i*, sinon « non couverte ». Pas de forward-fill (une phrase non
 *    annotée est réellement vide).
 *  - LLM : modèle de bloc — le thème forward-fill depuis l'ancre (réutilise `themeByIndex`).
 *
 * Mesure = accord sur l'INTERSECTION : parmi les phrases co-couvertes par les DEUX
 * parties (toutes deux non vides), la fraction qui porte le même thème. C'est la lecture
 * la plus pertinente « à quel point suis-je d'accord avec ce modèle » : tant que je n'ai
 * annoté que quelques phrases, on ne me pénalise pas pour celles que je n'ai pas encore
 * traitées (contrairement à un accord sur l'union). `n` (co-couvertes) rend le support
 * explicite.
 */

import { themeByIndex } from "./llmAgreement";

/** Vecteur EXACT (modèle humain C4) : thème à l'index exact, sinon null. Défensif. */
export function themeVectorExact(
  anchors: { anchorIndex: number; theme: string }[],
  n: number,
): (string | null)[] {
  if (!Number.isInteger(n) || n <= 0) return [];
  const out: (string | null)[] = new Array(n).fill(null);
  for (const a of anchors ?? []) {
    if (Number.isInteger(a.anchorIndex) && a.anchorIndex >= 0 && a.anchorIndex < n) {
      out[a.anchorIndex] = a.theme;
    }
  }
  return out;
}

/** Vecteurs par juge (forward-fill, modèle de bloc) depuis les pré-annotations. */
export function judgeVectorsFromPre(
  preByJudge: Record<string, { clauses?: { anchorIndex: number; themeCode: string }[] }>,
  n: number,
): Record<string, (string | null)[]> {
  const out: Record<string, (string | null)[]> = {};
  for (const [id, p] of Object.entries(preByJudge ?? {})) {
    out[id] = themeByIndex(
      (p?.clauses ?? []).map((c) => ({ anchorIndex: c.anchorIndex, theme: c.themeCode })),
      n,
    );
  }
  return out;
}

export interface PairAgreement {
  /** % d'accord sur l'intersection (0–100), ou null si aucune phrase co-couverte. */
  pct: number | null;
  /** Nombre de phrases co-couvertes (support de la mesure). */
  n: number;
  /** Nombre de phrases co-couvertes en accord. */
  matches: number;
}

/** Accord sur l'INTERSECTION de deux projections par phrase (mêmes indices). */
export function intersectionAgreement(
  a: (string | null)[],
  b: (string | null)[],
): PairAgreement {
  const len = Math.min(a.length, b.length);
  let n = 0;
  let matches = 0;
  for (let i = 0; i < len; i += 1) {
    if (a[i] != null && b[i] != null) {
      n += 1;
      if (a[i] === b[i]) matches += 1;
    }
  }
  return { n, matches, pct: n === 0 ? null : (matches / n) * 100 };
}

export interface JudgeConcordance {
  judge: string;
  pct: number | null;
  n: number;
  matches: number;
}

export interface LlmPair {
  a: string;
  b: string;
  pct: number | null;
  n: number;
}

export interface ConcordanceReport {
  /** Accord humain ↔ chaque juge, trié par % décroissant (juges sans support en fin). */
  perJudge: JudgeConcordance[];
  /** Juge le plus concordant avec l'humain (support > 0), ou null. */
  bestMatch: { judge: string; pct: number } | null;
  /** Accord LLM ↔ LLM, paire à paire. */
  llmPairs: LlmPair[];
  /** Moyenne des accords LLM ↔ LLM (paires avec support), ou null. */
  llmMeanPct: number | null;
  /** Nombre de phrases que l'humain a annotées (couverture humaine). */
  humanCovered: number;
}

/**
 * Rapport de concordance complet à partir du vecteur humain (exact) et des vecteurs
 * des juges (forward-fill). PUR et déterministe.
 */
export function concordanceReport(
  humanVec: (string | null)[],
  judgeVecs: Record<string, (string | null)[]>,
): ConcordanceReport {
  const judges = Object.keys(judgeVecs);

  const perJudge: JudgeConcordance[] = judges.map((j) => {
    const r = intersectionAgreement(humanVec, judgeVecs[j]!);
    return { judge: j, pct: r.pct, n: r.n, matches: r.matches };
  });
  // Tri : meilleurs accords d'abord ; les juges sans support (pct null) en dernier.
  perJudge.sort((x, y) => {
    if (x.pct == null && y.pct == null) return 0;
    if (x.pct == null) return 1;
    if (y.pct == null) return -1;
    return y.pct - x.pct;
  });

  const withSupport = perJudge.filter((p) => p.pct != null);
  const bestMatch =
    withSupport.length > 0
      ? { judge: withSupport[0]!.judge, pct: withSupport[0]!.pct as number }
      : null;

  const llmPairs: LlmPair[] = [];
  for (let i = 0; i < judges.length; i += 1) {
    for (let j = i + 1; j < judges.length; j += 1) {
      const a = judges[i]!;
      const b = judges[j]!;
      const r = intersectionAgreement(judgeVecs[a]!, judgeVecs[b]!);
      llmPairs.push({ a, b, pct: r.pct, n: r.n });
    }
  }
  const pcts = llmPairs.map((p) => p.pct).filter((p): p is number => p != null);
  const llmMeanPct =
    pcts.length === 0 ? null : pcts.reduce((s, v) => s + v, 0) / pcts.length;

  const humanCovered = humanVec.filter((t) => t != null).length;

  return { perJudge, bestMatch, llmPairs, llmMeanPct, humanCovered };
}
