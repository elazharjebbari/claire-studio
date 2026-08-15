/**
 * Formatage des grandeurs statistiques — fonctions PURES, testées.
 *
 * Conventions typographiques françaises de l'app : virgule décimale non requise ici
 * (les chiffres restent en notation point, cohérents avec le reste du Lab), mais
 * espaces insécables entre crochets d'IC et signe explicite sur les deltas.
 */

import type { MetricCi } from "./types";

export function fmtMetric(value: number | null | undefined, digits = 3): string {
  return value == null || Number.isNaN(value) ? "—" : value.toFixed(digits);
}

/** Nombre avec moins TYPOGRAPHIQUE (−), cohérent avec `fmtSigned`. */
function fmtNum(value: number, digits: number): string {
  return value.toFixed(digits).replace("-", "−");
}

/** « [0.482 – 0.558] » — ou null si l'IC est inexploitable (bornes manquantes). */
export function fmtCi(ci: MetricCi | null | undefined, digits = 3): string | null {
  if (!ci || ci.low == null || ci.high == null) return null;
  return `[${fmtNum(ci.low, digits)} – ${fmtNum(ci.high, digits)}]`;
}

/** « ± 0.028 » — dispersion inter-plis, ou null si absente. */
export function fmtDispersion(std: number | null | undefined, digits = 3): string | null {
  if (std == null || Number.isNaN(std)) return null;
  return `± ${std.toFixed(digits)}`;
}

/** « +0.020 » / « −0.004 » — signe TOUJOURS explicite (un Δ sans signe est illisible). */
export function fmtSigned(value: number | null | undefined, digits = 3): string {
  if (value == null || Number.isNaN(value)) return "—";
  const text = Math.abs(value).toFixed(digits);
  return value < 0 ? `−${text}` : `+${text}`;
}

/**
 * « p = 0.011 » ; sous la résolution du test de permutation, « p < 1/n » honnête plutôt
 * qu'un zéro impossible (la correction +1 garantit p ≥ 1/(n+1)).
 */
export function fmtPValue(p: number | null | undefined, nPermutations?: number): string {
  if (p == null || Number.isNaN(p)) return "p — indisponible";
  if (nPermutations && p <= 1 / (nPermutations + 1) + 1e-12) {
    return `p < ${(1 / nPermutations).toFixed(4)}`;
  }
  return `p = ${p.toFixed(3)}`;
}

/**
 * Part du plafond humain : « 104 % du plafond humain approximé » — la formulation
 * verrouillée (docs/pactiva-lab-resultats/05 §4) : jamais « bat/dépasse l'humain ».
 */
export function fmtCeilingShare(
  value: number | null | undefined,
  ceiling: number | null | undefined,
): string | null {
  if (value == null || ceiling == null || ceiling <= 0) return null;
  return `${Math.round((value / ceiling) * 100)} % du plafond humain approximé`;
}

/** L'IC du Δ contient-il 0 ? (bornes absentes → indéterminé, null) */
export function deltaContainsZero(ci: { low: number | null; high: number | null }): boolean | null {
  if (ci.low == null || ci.high == null) return null;
  return ci.low <= 0 && 0 <= ci.high;
}
