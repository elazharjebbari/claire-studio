/**
 * Couverture du plan (correctif « blocks manquants ») — calcul PUR des phrases NON
 * ANNOTÉES d'un document, pour les exposer et les rendre navigables dans le plan
 * (TocPanel). Le modèle est per-sentence (C4) : chaque phrase annotée est sa propre
 * clause/ancre ; une phrase sans clause est un « trou » de couverture. Sur un long
 * document partiellement annoté, ces trous étaient invisibles dans le plan (qui ne
 * liste que les clauses) — d'où l'impression de blocks manquants.
 *
 * Sans React, testable isolément.
 */

/** Plage contiguë de phrases NON annotées. */
export interface CoverageGap {
  /** Première phrase non annotée de la plage (incluse). */
  start: number;
  /** Dernière phrase non annotée de la plage (incluse). */
  end: number;
  /** Nombre de phrases de la plage (= end - start + 1). */
  count: number;
}

/** Item du plan en ordre document : une clause (ancre) ou un trou de couverture. */
export type PlanItem =
  | { type: "clause"; anchorIndex: number }
  | { type: "gap"; start: number; end: number; count: number };

/** Ensemble trié+dédupliqué des ancres valides dans [0, n). */
function normalizedAnchors(anchorIndexes: number[], n: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const i of anchorIndexes) {
    if (Number.isInteger(i) && i >= 0 && i < n && !seen.has(i)) {
      seen.add(i);
      out.push(i);
    }
  }
  out.sort((a, b) => a - b);
  return out;
}

/**
 * Plages contiguës de phrases NON annotées dans [0, n), en ordre document.
 * Renvoie [] si tout est couvert (ou n<=0).
 */
export function coverageGaps(anchorIndexes: number[], n: number): CoverageGap[] {
  if (!Number.isInteger(n) || n <= 0) return [];
  const anchors = new Set(normalizedAnchors(anchorIndexes, n));
  const gaps: CoverageGap[] = [];
  let runStart: number | null = null;
  for (let i = 0; i < n; i += 1) {
    const covered = anchors.has(i);
    if (!covered && runStart === null) runStart = i;
    if (covered && runStart !== null) {
      gaps.push({ start: runStart, end: i - 1, count: i - runStart });
      runStart = null;
    }
  }
  if (runStart !== null) gaps.push({ start: runStart, end: n - 1, count: n - runStart });
  return gaps;
}

/** Nombre de phrases non annotées. */
export function uncoveredCount(anchorIndexes: number[], n: number): number {
  if (!Number.isInteger(n) || n <= 0) return 0;
  return n - normalizedAnchors(anchorIndexes, n).length;
}

/**
 * Index de la PROCHAINE phrase non annotée strictement après `from`, en bouclant
 * jusqu'à `from` (cyclique) ; null si TOUTES les phrases sont annotées.
 * `from` peut valoir -1 pour démarrer au début.
 */
export function nextUncovered(
  anchorIndexes: number[],
  n: number,
  from: number,
): number | null {
  if (!Number.isInteger(n) || n <= 0) return null;
  const anchors = new Set(normalizedAnchors(anchorIndexes, n));
  if (anchors.size >= n) return null; // tout est couvert
  const startAt = Number.isInteger(from) ? from : -1;
  for (let step = 1; step <= n; step += 1) {
    const i = ((startAt + step) % n + n) % n;
    if (!anchors.has(i)) return i;
  }
  return null;
}

/**
 * Plan en ordre document : clauses (ancres) et trous (runs non annotés) entremêlés,
 * de sorte que le plan reflète TOUTE la structure du document, pas seulement les
 * clauses. `anchorIndexes` n'a pas besoin d'être trié.
 */
export function planOutline(anchorIndexes: number[], n: number): PlanItem[] {
  if (!Number.isInteger(n) || n <= 0) return [];
  const anchors = normalizedAnchors(anchorIndexes, n);
  const anchorSet = new Set(anchors);
  const items: PlanItem[] = [];
  let i = 0;
  while (i < n) {
    if (anchorSet.has(i)) {
      items.push({ type: "clause", anchorIndex: i });
      i += 1;
    } else {
      const start = i;
      while (i < n && !anchorSet.has(i)) i += 1;
      items.push({ type: "gap", start, end: i - 1, count: i - start });
    }
  }
  return items;
}
