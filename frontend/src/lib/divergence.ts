/**
 * Calcul PUR des divergences inter-juges (Claude vs Codex) au niveau phrase (P1).
 * Brique testée isolément (tests/divergence.test.ts), sans React.
 *
 * Entrée : deux projections par phrase (cf. lib/llmAgreement.ts `themeByIndex`),
 * où `null` = phrase non couverte par ce juge. Une DIVERGENCE est une phrase pour
 * laquelle les deux juges proposent un thème ET ces thèmes diffèrent. Les phrases
 * couvertes par un seul juge (l'autre = null) sont des « couvertures partielles »,
 * signalées à part : utiles à l'arbitrage mais distinctes d'un vrai désaccord de thème.
 *
 * On regroupe les phrases divergentes contiguës en SEGMENTS pour que la navigation
 * saute d'un *bloc* de désaccord au suivant (et non phrase par phrase), ce qui colle
 * à la structure en clauses.
 */

/** Un segment contigu de divergence : [start, end] inclusifs (indices de phrase). */
export interface DivergenceSegment {
  start: number;
  end: number;
}

/** Vrai si la phrase `i` est une divergence stricte (deux thèmes présents, différents). */
export function isDivergent(
  claudeByIndex: (string | null)[],
  codexByIndex: (string | null)[],
  i: number,
): boolean {
  const a = claudeByIndex[i] ?? null;
  const b = codexByIndex[i] ?? null;
  return a != null && b != null && a !== b;
}

/**
 * Indices des phrases en divergence stricte (thèmes présents des deux côtés et
 * différents), triés croissants. Tolère des tableaux de longueurs différentes.
 */
export function divergenceIndices(
  claudeByIndex: (string | null)[],
  codexByIndex: (string | null)[],
): number[] {
  const n = Math.max(claudeByIndex.length, codexByIndex.length);
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    if (isDivergent(claudeByIndex, codexByIndex, i)) out.push(i);
  }
  return out;
}

/**
 * Regroupe les phrases divergentes contiguës en segments. La navigation s'appuie sur
 * le `start` de chaque segment (point d'ancrage logique de la frontière à arbitrer).
 */
export function divergenceSegments(
  claudeByIndex: (string | null)[],
  codexByIndex: (string | null)[],
): DivergenceSegment[] {
  const idx = divergenceIndices(claudeByIndex, codexByIndex);
  const segments: DivergenceSegment[] = [];
  for (const i of idx) {
    const last = segments[segments.length - 1];
    if (last && i === last.end + 1) {
      last.end = i;
    } else {
      segments.push({ start: i, end: i });
    }
  }
  return segments;
}

/** Points d'ancrage de navigation : le `start` de chaque segment de divergence. */
export function divergenceAnchors(
  claudeByIndex: (string | null)[],
  codexByIndex: (string | null)[],
): number[] {
  return divergenceSegments(claudeByIndex, codexByIndex).map((s) => s.start);
}

/**
 * Ancre de divergence suivante STRICTEMENT après `cursor` (boucle au début si on est
 * au-delà de la dernière). Renvoie null si la liste est vide.
 */
export function nextDivergence(anchors: number[], cursor: number): number | null {
  if (anchors.length === 0) return null;
  const next = anchors.find((a) => a > cursor);
  return next ?? anchors[0]!;
}

/**
 * Ancre de divergence précédente STRICTEMENT avant `cursor` (boucle à la fin si on
 * est avant la première). Renvoie null si la liste est vide.
 */
export function prevDivergence(anchors: number[], cursor: number): number | null {
  if (anchors.length === 0) return null;
  for (let i = anchors.length - 1; i >= 0; i -= 1) {
    if (anchors[i]! < cursor) return anchors[i]!;
  }
  return anchors[anchors.length - 1]!;
}

/**
 * Position 1-based d'un curseur dans la liste d'ancres pour l'affichage « k / N ».
 * Renvoie l'index de l'ancre exactement égale au curseur, sinon 0 (hors d'une ancre).
 */
export function divergenceOrdinal(anchors: number[], cursor: number): number {
  const i = anchors.indexOf(cursor);
  return i >= 0 ? i + 1 : 0;
}
