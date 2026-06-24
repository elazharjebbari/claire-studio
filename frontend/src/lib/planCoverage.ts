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

// (Le plan affiche désormais UN bloc par phrase ; le regroupement en « plan outline »
// n'est plus nécessaire — voir TocPanel qui itère directement les phrases.)

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
