/**
 * Palette des graphes — **validée**, pas choisie à l'œil.
 *
 * Les quatre teintes catégorielles ont été passées au validateur de la méthode dataviz
 * (bandes de clarté, plancher de chroma, séparation sous déficience de vision des
 * couleurs, contraste sur la surface), dans les DEUX modes :
 *
 *   clair  (surface #FFFFFF) : bande L ✓ · chroma ✓ · ΔE protan 9,1 ✓ · normal 22,9 ✓
 *                              contraste : relief requis (étiquettes visibles + table)
 *   sombre (surface #141B26) : bande L ✓ · chroma ✓ · ΔE protan 8,4 ✓ · normal 19,8 ✓
 *                              contraste ✓ (les 4 ≥ 3:1)
 *
 * ⚠️ Ne pas modifier ces valeurs sans relancer le validateur. Et ne jamais « cycler »
 * les teintes : au-delà de quatre séries, on facette au lieu d'inventer une couleur.
 *
 * En mode clair, deux teintes sont sous 3:1 sur blanc — le relief exigé est fourni par
 * les étiquettes directes et l'équivalent tabulaire présents sur chaque figure.
 *
 * Ces couleurs sont exposées en variables CSS pour que le basculement clair/sombre se
 * fasse en un seul endroit, et pour que la garde anti-hex du projet reste satisfaite :
 * les composants ne portent jamais de hex, seulement `var(--viz-series-N)`.
 */

export const SERIES_SLOTS = 4;

/** Rôle de chaque emplacement — assigné dans un ORDRE FIXE, jamais par rang. */
export const SERIES_VARS = [
  "var(--viz-series-1)",
  "var(--viz-series-2)",
  "var(--viz-series-3)",
  "var(--viz-series-4)",
] as const;

export const VIZ_VARS = {
  surface: "var(--viz-surface)",
  grid: "var(--viz-grid)",
  axis: "var(--viz-axis)",
  ink: "var(--viz-ink)",
  inkMuted: "var(--viz-ink-muted)",
  threshold: "var(--viz-threshold)",
  positive: "var(--viz-positive)",
  negative: "var(--viz-negative)",
} as const;

/**
 * Couleur d'une série. Au-delà de quatre, on ne cycle pas : l'appelant doit facetter
 * ou regrouper en « autres ». Renvoyer une teinte réutilisée créerait deux séries de
 * même couleur dans la même figure — une erreur silencieuse.
 */
export function seriesColor(index: number): string {
  if (index < 0 || index >= SERIES_SLOTS) return VIZ_VARS.inkMuted;
  return SERIES_VARS[index]!;
}

/**
 * Intensité d'une carte de chaleur séquentielle : une seule teinte, du clair au foncé.
 * Jamais d'arc-en-ciel — l'ordre des teintes n'est pas perçu comme un ordre de valeur.
 */
export function sequentialOpacity(value: number, domainMax = 1): number {
  if (!Number.isFinite(value) || domainMax <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, value / domainMax));
  // Plancher à 0,08 : une cellule à valeur faible doit rester visible comme « faible »,
  // pas disparaître comme « absente » — les deux ne veulent pas dire la même chose.
  return 0.08 + ratio * 0.84;
}

/** Motif de texture pour le cas daltonisme / impression / contrastes forcés. */
export const TEXTURE_ID = "viz-hatch";
