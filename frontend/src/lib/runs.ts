/**
 * Calcul pur des « runs » de clause (P2). Un run est l'étendue de phrases couverte
 * par une clause : du min de son ancre jusqu'à juste avant l'ancre suivante. Le
 * préfixe sans ancre (avant la 1re ancre) forme un run « neutre » sans thème.
 *
 * Utilisé pour : le rail coloré gauche + pointillés de frontière (DocumentPanel),
 * et le calcul d'accord LLM (thème proposé par chaque juge pour une phrase donnée).
 *
 * Fonctions PURES, sans dépendance React → testables isolément (tests/runs.test.ts).
 */

export interface RunAnchor {
  anchorIndex: number;
  theme: string;
  localId: string;
}

export interface Run {
  start: number;
  end: number;
  theme: string | null;
  localId: string | null;
}

/**
 * Découpe [0, nSentences) en runs contigus, triés par anchorIndex.
 *
 * Deux modes :
 *  - **span / forward-fill** (défaut) : chaque clause couvre de son ancre jusqu'à
 *    (ancre suivante − 1), bornée à nSentences−1. Utilisé pour les SEGMENTS LLM
 *    (data `start_id` + thème) qui sont par nature des spans.
 *  - **perSentence** (C4) : chaque clause couvre EXACTEMENT sa phrase `[ancre, ancre]` ;
 *    tout le reste (avant/entre/après) forme des runs neutres `{theme:null}`. Utilisé
 *    pour l'annotation HUMAINE — annoter une phrase n'affecte qu'elle (pas de
 *    débordement vers les phrases suivantes).
 *
 * Défensif : ancres hors bornes ignorées, doublons d'ancre fusionnés (1re gagne).
 */
export function computeRuns(
  drafts: RunAnchor[],
  nSentences: number,
  opts?: { perSentence?: boolean },
): Run[] {
  if (nSentences <= 0) return [];

  // Trie + déduplique par anchorIndex en gardant des ancres valides dans [0, n).
  const seen = new Set<number>();
  const anchors = drafts
    .filter((d) => Number.isInteger(d.anchorIndex) && d.anchorIndex >= 0 && d.anchorIndex < nSentences)
    .slice()
    .sort((a, b) => a.anchorIndex - b.anchorIndex)
    .filter((d) => {
      if (seen.has(d.anchorIndex)) return false;
      seen.add(d.anchorIndex);
      return true;
    });

  const runs: Run[] = [];

  if (opts?.perSentence) {
    // Chaque clause = sa propre phrase ; les intervalles libres = runs neutres.
    let cursor = 0;
    for (const a of anchors) {
      if (a.anchorIndex > cursor) {
        runs.push({ start: cursor, end: a.anchorIndex - 1, theme: null, localId: null });
      }
      runs.push({ start: a.anchorIndex, end: a.anchorIndex, theme: a.theme, localId: a.localId });
      cursor = a.anchorIndex + 1;
    }
    if (cursor < nSentences) {
      runs.push({ start: cursor, end: nSentences - 1, theme: null, localId: null });
    }
    return runs;
  }

  // Préfixe neutre si la 1re ancre n'est pas en 0.
  const firstAnchor = anchors[0]?.anchorIndex ?? nSentences;
  if (firstAnchor > 0) {
    runs.push({ start: 0, end: firstAnchor - 1, theme: null, localId: null });
  }

  for (let i = 0; i < anchors.length; i += 1) {
    const a = anchors[i]!;
    const nextStart = anchors[i + 1]?.anchorIndex ?? nSentences;
    runs.push({
      start: a.anchorIndex,
      end: nextStart - 1,
      theme: a.theme,
      localId: a.localId,
    });
  }

  return runs;
}

/** Run couvrant l'index donné (ou undefined si hors de tout run). */
export function runAt(runs: Run[], index: number): Run | undefined {
  return runs.find((r) => index >= r.start && index <= r.end);
}

/**
 * Plage ORDONNÉE de localId de clauses (P8) dont le run chevauche [fromIndex, toIndex].
 * Sert au mapping « plage de phrases → clauses » de la sélection multi-blocs au
 * bouton droit. Les runs neutres (localId === null) sont ignorés. L'ordre de sortie
 * suit l'ordre des runs (donc l'ordre des ancres).
 */
export function clauseRangeBetween(
  runs: Run[],
  fromIndex: number,
  toIndex: number,
): string[] {
  const lo = Math.min(fromIndex, toIndex);
  const hi = Math.max(fromIndex, toIndex);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const r of runs) {
    if (r.localId == null) continue;
    if (r.end >= lo && r.start <= hi && !seen.has(r.localId)) {
      seen.add(r.localId);
      ids.push(r.localId);
    }
  }
  return ids;
}

/** Thème du run couvrant `index` (null si run neutre / hors bornes). */
export function runThemeAt(runs: Run[], index: number): string | null {
  return runAt(runs, index)?.theme ?? null;
}

/**
 * Thème proposé par un juge LLM pour la phrase `index`, déduit des clauses fantômes.
 * On reconstruit les runs des fantômes du juge puis on lit le thème couvrant l'index.
 */
export function judgeThemeAt(
  ghosts: Array<{ anchorIndex: number; theme: string; judge: string }>,
  judge: string,
  index: number,
  nSentences: number,
): string | null {
  const forJudge = ghosts
    .filter((g) => g.judge === judge)
    .map((g, i) => ({ anchorIndex: g.anchorIndex, theme: g.theme, localId: `${judge}-${i}` }));
  if (forJudge.length === 0) return null;
  const runs = computeRuns(forJudge, nSentences);
  return runThemeAt(runs, index);
}
