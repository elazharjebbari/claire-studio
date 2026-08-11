/**
 * Échelles et axes — fonctions PURES, testables sans rendu.
 *
 * Écrites à la main plutôt qu'importées d'une bibliothèque de graphes, pour trois
 * raisons décidées dans `docs/pactiva-lab/03_UX_UI.md` §4.1 : l'export vectoriel est
 * l'exigence n°1 (le DOM EST la figure, l'export est une sérialisation), le projet a des
 * tokens de couleur et une garde anti-hex qu'une bibliothèque contournerait, et ces
 * fonctions sont testables comme le reste du code métier.
 */

export type Scale = (value: number) => number;

export interface Range {
  min: number;
  max: number;
}

/** Domaine d'une série, avec repli sûr sur les cas dégénérés. */
export function extent(values: number[]): Range {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  // Une série constante donnerait un domaine de largeur nulle et une division par zéro :
  // on l'élargit autour de la valeur plutôt que de rendre NaN.
  if (min === max) return min === 0 ? { min: 0, max: 1 } : { min: min * 0.9, max: max * 1.1 };
  return { min, max };
}

export function scaleLinear(domain: Range, range: Range): Scale {
  const span = domain.max - domain.min;
  if (span === 0) return () => range.min;
  const factor = (range.max - range.min) / span;
  return (value: number) => range.min + (value - domain.min) * factor;
}

/**
 * Échelle logarithmique — pour la longue traîne des thèmes (de 1 163 à 31 occurrences),
 * illisible en linéaire.
 *
 * Les valeurs ≤ 0 n'ont pas d'image en log. Plutôt que de rendre `NaN` (qui produirait
 * un chemin SVG invalide et une figure muette), on les projette sur le minimum : le
 * point reste visible et l'axe reste juste.
 */
export function scaleLog(domain: Range, range: Range): Scale {
  const min = Math.max(domain.min, 1e-9);
  const max = Math.max(domain.max, min * 10);
  const logMin = Math.log10(min);
  const factor = (range.max - range.min) / (Math.log10(max) - logMin);
  return (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return range.min;
    return range.min + (Math.log10(value) - logMin) * factor;
  };
}

/** Échelle de bandes (catégories) : position et largeur de chaque bande. */
export function scaleBand(count: number, range: Range, padding = 0.2) {
  const span = range.max - range.min;
  const step = count > 0 ? span / count : span;
  const width = step * (1 - padding);
  return {
    step,
    bandwidth: Math.max(1, width),
    position: (index: number) => range.min + index * step + (step - width) / 2,
  };
}

/**
 * Graduations « rondes » — jamais 0,0347. Un axe se lit, il ne se déchiffre pas.
 */
export function ticks(domain: Range, count = 5): number[] {
  const span = domain.max - domain.min;
  if (span <= 0 || !Number.isFinite(span)) return [domain.min];
  const rawStep = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  // Le plus petit pas « rond » qui soit ≥ au pas brut : 1, 2, 5 ou 10 × magnitude.
  // (Prendre le plus GRAND donnerait 3 graduations là où on en demande 5.)
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = nice * magnitude;
  const start = Math.ceil(domain.min / step) * step;
  const out: number[] = [];
  for (let value = start; value <= domain.max + step * 1e-9; value += step) {
    // L'arrondi corrige l'accumulation de flottants (0.30000000000000004).
    out.push(Number(value.toFixed(10)));
  }
  return out;
}

/** Graduations logarithmiques : les puissances de dix comprises dans le domaine. */
export function logTicks(domain: Range): number[] {
  const min = Math.max(domain.min, 1);
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(domain.max)); e += 1) {
    const value = 10 ** e;
    if (value >= min * 0.99 && value <= domain.max * 1.01) out.push(value);
  }
  return out.length > 0 ? out : [min];
}

/** Formatage compact pour les étiquettes d'axe. */
export function formatTick(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1000) return `${Math.round(value / 100) / 10}k`;
  if (abs >= 1) return String(Math.round(value * 100) / 100);
  if (abs === 0) return "0";
  return String(Math.round(value * 1000) / 1000);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 1000) / 10} %`;
}

/** Chemin SVG d'une polyligne. Les points non finis coupent le trait au lieu de le
 * corrompre : une figure incomplète vaut mieux qu'une figure fausse. */
export function linePath(points: Array<[number, number]>): string {
  const parts: string[] = [];
  let pendingMove = true;
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      pendingMove = true;
      continue;
    }
    parts.push(`${pendingMove ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
    pendingMove = false;
  }
  return parts.join(" ");
}
