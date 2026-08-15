/**
 * Analyse de sweep — fonctions PURES (docs/pactiva-lab-resultats/03 §b-c).
 *
 * Trois outils : l'ajustement en loi de puissance de la courbe d'apprentissage (avec
 * ses gardes d'honnêteté), les effets marginaux par axe du criblage, et la règle de
 * survie « retenue si son IC touche celui de la meilleure ».
 */

export interface SweepPoint {
  x: number;
  y: number;
}

export interface PowerLawFit {
  /** F1(n) = a − b·n^(−c) : `a` = asymptote, `b` = amplitude, `c` = vitesse. */
  a: number;
  b: number;
  c: number;
  /** Somme des carrés des résidus — pour le choix de `c` en balayage. */
  sse: number;
}

/**
 * Ajuste F1(n) = a − b·n^(−c) par balayage de `c` (moindres carrés linéaires en a, b à
 * c fixé). Refuse (null) ce qui ne peut pas s'ajuster honnêtement : moins de 3 tailles
 * distinctes, ou un ajustement dégénéré (b ≤ 0 : la « courbe » monterait sans limite
 * en remontant le temps — un artefact, pas un apprentissage).
 */
export function fitPowerLaw(points: SweepPoint[]): PowerLawFit | null {
  const clean = points.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > 0,
  );
  const distinctX = new Set(clean.map((p) => p.x));
  if (distinctX.size < 3) return null;

  let best: PowerLawFit | null = null;
  for (let step = 1; step <= 40; step += 1) {
    const c = step * 0.05; // c ∈ [0,05 ; 2] — au-delà, la loi devient une marche
    // Régression linéaire y = a − b·t avec t = x^(−c).
    const t = clean.map((p) => p.x ** -c);
    const n = clean.length;
    const meanT = t.reduce((s, v) => s + v, 0) / n;
    const meanY = clean.reduce((s, p) => s + p.y, 0) / n;
    let covTY = 0;
    let varT = 0;
    for (let i = 0; i < n; i += 1) {
      covTY += (t[i]! - meanT) * (clean[i]!.y - meanY);
      varT += (t[i]! - meanT) ** 2;
    }
    if (varT < 1e-12) continue;
    const slope = covTY / varT; // = −b
    const b = -slope;
    const a = meanY + b * meanT;
    let sse = 0;
    for (let i = 0; i < n; i += 1) {
      sse += (clean[i]!.y - (a - b * t[i]!)) ** 2;
    }
    if (best === null || sse < best.sse) best = { a, b, c, sse };
  }
  if (!best || best.b <= 0) return null;
  return best;
}

export function powerLawValue(fit: PowerLawFit, x: number): number {
  return fit.a - fit.b * x ** -fit.c;
}

/**
 * Borne d'extrapolation honnête : 2,5× la plus grande taille OBSERVÉE (dossier 03 §c —
 * « extrapoler au plus à 2–3×, jamais “le modèle atteindra” »).
 */
export function extrapolationLimit(points: SweepPoint[]): number {
  const maxX = Math.max(...points.map((p) => p.x), 0);
  return Math.round(maxX * 2.5);
}

// --------------------------------------------------------------------------- //
// Criblage — effets marginaux par axe
// --------------------------------------------------------------------------- //

export interface AxisEffect {
  /** Chemin de l'axe dans la config (ex. "preprocess.case"). */
  axis: string;
  /** Moyenne de la métrique par valeur de l'axe (grille complète → moyennes équilibrées). */
  perValue: Array<{ value: string; mean: number; n: number }>;
  /** Ampleur : max − min des moyennes par valeur — « cet axe compte-t-il ? ». */
  effect: number;
}

function flatten(config: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof config !== "object" || config === null) return out;
  for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(out, flatten(value, path));
    } else {
      out[path] = JSON.stringify(value);
    }
  }
  return out;
}

/** Clés jamais traitées comme axes : identifiants et méta, pas des choix d'expérience. */
const AXIS_EXCLUDES = new Set(["datasetId", "version"]);

/**
 * Effets marginaux : pour chaque chemin de config qui VARIE entre les runs, la moyenne
 * de la métrique par valeur. Valide parce que `expand_sweep` produit une grille
 * cartésienne COMPLÈTE — les moyennes marginales y sont équilibrées par construction
 * (~5 comparaisons d'axes au lieu de 276 paires, dossier 03 §b).
 */
export function marginalAxisEffects(
  runs: Array<{ config: Record<string, unknown>; value: number | null }>,
): AxisEffect[] {
  const usable = runs.filter((r) => r.value != null);
  if (usable.length < 2) return [];
  const flats = usable.map((r) => flatten(r.config));
  const paths = new Set<string>();
  for (const flat of flats) for (const path of Object.keys(flat)) paths.add(path);

  const effects: AxisEffect[] = [];
  for (const path of [...paths].sort()) {
    const leaf = path.split(".").pop() ?? path;
    if (AXIS_EXCLUDES.has(leaf)) continue;
    const groups = new Map<string, number[]>();
    for (let i = 0; i < usable.length; i += 1) {
      const value = flats[i]![path] ?? "∅";
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value)!.push(usable[i]!.value!);
    }
    if (groups.size < 2) continue; // pas un axe : la valeur ne varie pas
    const perValue = [...groups.entries()]
      .map(([value, values]) => ({
        value: value.replace(/^"|"$/g, ""),
        mean: values.reduce((s, v) => s + v, 0) / values.length,
        n: values.length,
      }))
      .sort((a, b) => b.mean - a.mean);
    const means = perValue.map((v) => v.mean);
    effects.push({
      axis: path,
      perValue,
      effect: Math.max(...means) - Math.min(...means),
    });
  }
  return effects.sort((a, b) => b.effect - a.effect);
}

// --------------------------------------------------------------------------- //
// Règle de survie du criblage
// --------------------------------------------------------------------------- //

export interface RankedRun {
  id: string;
  value: number | null;
  ci: { low: number | null; high: number | null } | null;
}

/**
 * « Retenue si son IC touche celui de la meilleure » (top-k honnête, dossier 03 §b) :
 * renvoie l'ensemble des ids survivants. Sans IC exploitable, un run ne survit que
 * s'il EST le meilleur — l'absence d'incertitude ne vaut pas un laissez-passer.
 */
export function survivalSet(runs: RankedRun[]): Set<string> {
  const scored = runs.filter((r) => r.value != null);
  if (scored.length === 0) return new Set();
  const best = scored.reduce((a, b) => (b.value! > a.value! ? b : a));
  const survivors = new Set<string>([best.id]);
  if (best.ci?.low == null) return survivors;
  for (const run of scored) {
    if (run.ci?.high != null && run.ci.high >= best.ci.low) survivors.add(run.id);
  }
  return survivors;
}

/**
 * Libellé court d'une variante de sweep : ses valeurs sur les axes qui VARIENT
 * (« case=lower · ngram=2 ») — jamais la config entière.
 */
export function variantLabel(
  config: Record<string, unknown>,
  runs: Array<{ config: Record<string, unknown> }>,
): string {
  const flats = runs.map((r) => flatten(r.config));
  const mine = flatten(config);
  const varying: string[] = [];
  for (const path of Object.keys(mine).sort()) {
    const leaf = path.split(".").pop() ?? path;
    if (AXIS_EXCLUDES.has(leaf)) continue;
    const values = new Set(flats.map((f) => f[path] ?? "∅"));
    if (values.size > 1) {
      varying.push(`${leaf}=${(mine[path] ?? "∅").replace(/^"|"$/g, "")}`);
    }
  }
  return varying.join(" · ") || "configuration unique";
}
