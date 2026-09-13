/**
 * Taxonomies de thèmes — projection PURE T20 → T14 / T11 / T10.
 *
 * PRINCIPE ARCHITECTURAL : **T20 est canonique**. C'est la taxonomie annotée, stockée en
 * base et transmise sur le fil ; T14/T11/T10 n'existent nulle part comme donnée — ce sont
 * des projections déterministes calculées à l'affichage. Changer de taxonomie dans l'UI ne
 * duplique rien, n'altère rien, et reste réversible d'un clic.
 *
 * La spécification (`taxonomies.json`) est la SOURCE UNIQUE, lue à l'identique par ce
 * module et par Python (`research/pactiva_lab/taxonomy.py`, qui sert les expérimentations).
 * La parité est testée des deux côtés, sur le modèle des cas d'or du moteur gold.
 *
 * Traçabilité : une macro-catégorie porte toujours la liste de ses thèmes T20 (`members`),
 * ce qui permet à l'interface de répondre en un coup d'œil à « que contient cette classe ? ».
 */

import spec from "./taxonomies.json";

export type TaxonomyId = "T20" | "T14" | "T11" | "T10";

export interface TaxonomyCategory {
  code: string;
  label: string;
  description: string;
  color: string;
  /** Thème-refuge : jamais utilisable en étiquette secondaire (règle du protocole). */
  isRefuge?: boolean;
  /** Pourquoi ces thèmes sont regroupés (affiché dans le détail de catégorie). */
  rationale?: string;
  /** Les thèmes T20 que cette catégorie contient — la trace vers la source canonique. */
  members: string[];
}

export interface Taxonomy {
  id: TaxonomyId;
  label: string;
  short: string;
  rationale: string;
  categories: TaxonomyCategory[];
}

export interface TaxonomyPopulation {
  id: string;
  label: string;
  rationale: string;
  documents: string[];
  datasetFingerprint?: string;
}

export const TAXONOMY_SPEC_VERSION: number = spec.specVersion;
export const CANONICAL_TAXONOMY = spec.canonical as TaxonomyId;
export const TAXONOMIES = spec.taxonomies as Taxonomy[];
export const TAXONOMY_IDS = TAXONOMIES.map((t) => t.id);

export const POPULATIONS = {
  designSet: spec.populations.designSet as TaxonomyPopulation,
  holdout: spec.populations.holdout as TaxonomyPopulation,
};

const byId = new Map<string, Taxonomy>(TAXONOMIES.map((t) => [t.id, t]));

/** Index thème T20 → code de catégorie, par taxonomie (construit une fois). */
const projectionByTaxonomy = new Map<string, Map<string, string>>(
  TAXONOMIES.map((t) => [
    t.id,
    new Map(t.categories.flatMap((c) => c.members.map((m) => [m, c.code] as const))),
  ]),
);

const categoryIndex = new Map<string, Map<string, TaxonomyCategory>>(
  TAXONOMIES.map((t) => [t.id, new Map(t.categories.map((c) => [c.code, c]))]),
);

export function getTaxonomy(id: TaxonomyId): Taxonomy {
  const found = byId.get(id);
  if (!found) throw new Error(`taxonomie inconnue : ${id}`);
  return found;
}

/**
 * Projette un thème T20 vers la taxonomie demandée.
 *
 * Un code inconnu est renvoyé TEL QUEL : une taxonomie ne doit jamais faire disparaître
 * une donnée qu'elle ne sait pas classer (on préfère un thème visiblement hors schéma à
 * un silence). `null`/vide se propagent sans bruit.
 */
export function projectTheme(code: string | null | undefined, taxonomy: TaxonomyId): string {
  if (!code) return "";
  if (taxonomy === CANONICAL_TAXONOMY) return code;
  return projectionByTaxonomy.get(taxonomy)?.get(code) ?? code;
}

/**
 * Projette un JEU de thèmes (primaire + secondaires) en préservant l'ordre et en
 * DÉDUPLIQUANT : deux thèmes T20 distincts peuvent tomber dans la même macro-catégorie,
 * auquel cas la clause devient mono-étiquette dans cette taxonomie. C'est le comportement
 * voulu — et c'est précisément ce que mesure la baisse du taux multi-label après fusion.
 */
export function projectThemeSet(codes: readonly string[], taxonomy: TaxonomyId): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of codes) {
    const projected = projectTheme(code, taxonomy);
    if (projected && !seen.has(projected)) {
      seen.add(projected);
      out.push(projected);
    }
  }
  return out;
}

/** Catégorie d'un code DÉJÀ projeté (ou d'un thème T20 si taxonomy = T20). */
export function getCategory(
  code: string | null | undefined,
  taxonomy: TaxonomyId,
): TaxonomyCategory | null {
  if (!code) return null;
  return categoryIndex.get(taxonomy)?.get(code) ?? null;
}

/**
 * Catégorie d'un thème T20 dans la taxonomie demandée — le chemin complet en un appel
 * (projection + résolution), qui est ce dont l'affichage a besoin la plupart du temps.
 */
export function categoryOfTheme(
  t20Code: string | null | undefined,
  taxonomy: TaxonomyId,
): TaxonomyCategory | null {
  return getCategory(projectTheme(t20Code, taxonomy), taxonomy);
}

/** La catégorie regroupe-t-elle plusieurs thèmes T20 ? (déclenche l'affichage du détail) */
export function isMacroCategory(category: TaxonomyCategory | null): boolean {
  return !!category && category.members.length > 1;
}

/** Les thèmes T20 contenus dans une catégorie — la trace vers la source canonique.
 *
 * Renvoie une COPIE : la spécification est une donnée partagée et immuable, et des
 * opérations courantes (`.sort()`, `.reverse()`) trient EN PLACE. L'ordre des membres
 * n'est pas cosmétique — le premier est le thème-tête dont dérive le glyphe de la
 * macro-catégorie. */
export function membersOf(code: string, taxonomy: TaxonomyId): string[] {
  return [...(getCategory(code, taxonomy)?.members ?? [])];
}

/** Un document appartient-il au hold-out de validation ? (garde anti-contamination) */
export function isHoldoutDocument(externalId: string): boolean {
  return POPULATIONS.holdout.documents.includes(externalId);
}
