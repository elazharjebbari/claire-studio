/**
 * Enchaînement du rail d'actions rapides — logique PURE (testable sans l'atelier).
 *
 * Le bouton « Valider + suivant » n'est actif que sur une phrase PORTANT UNE CLAUSE : on ne
 * fabrique jamais de clause là où il n'y en a pas (pas de fragmentation de segment, pas
 * d'adoption d'un juge arbitraire). Or les clauses ne couvrent qu'une fraction des phrases
 * (ex. 20 clauses sur 93 phrases) : avancer d'UNE phrase déposait le curseur collant sur un
 * bouton désactivé — « curseur interdit », enchaînement cassé. On saute donc à la clause
 * suivante.
 */

/** Indices des phrases validables (= portant une clause), triés croissant. */
export function validatableIndicesOf(anchors: { anchorIndex: number }[]): number[] {
  return anchors.map((a) => a.anchorIndex).sort((a, b) => a - b);
}

/**
 * Prochaine phrase validable STRICTEMENT après `from`, ou `null` s'il n'y en a plus
 * (dernière clause du document : on valide sans avancer).
 */
export function nextValidatableIndex(indices: number[], from: number): number | null {
  for (const i of indices) if (i > from) return i;
  return null;
}
