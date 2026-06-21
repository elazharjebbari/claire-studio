/**
 * Dérivation PURE des « blocs » d'annotation (Feature B, spec §1).
 *
 * Un **bloc** est un intervalle MAXIMAL `[start..end]` de phrases CONSÉCUTIVES toutes
 * annotées du MÊME thème. C'est une **vue dérivée** des clauses par phrase (C4) — JAMAIS
 * un objet persistant : pas d'`end_index`, pas de `block_id`. La vérité reste « une
 * `Clause` = une phrase » ; le bloc n'est qu'un sucre d'interaction/visualisation, neutre
 * vis-à-vis de l'IAA (calculée par phrase). Voir `docs/pactiva/dossier-annotation-avancee/
 * 03-feature-B-annotation-bloc-phrase/B-specification.md`.
 *
 * Fonctions PURES (comme `lib/runs.ts`) → testables isolément.
 */

import type { Run } from "./runs";

export interface Block {
  /** Index de la 1re phrase du bloc. */
  start: number;
  /** Index de la dernière phrase (>= start). */
  end: number;
  /** Thème commun à toutes les phrases du bloc. */
  theme: string;
  /** Un localId par phrase, ordonné (length === end - start + 1). */
  localIds: string[];
  /** Nombre de phrases (end - start + 1). */
  size: number;
}

/**
 * Construit les blocs à partir des runs PAR PHRASE (`computeRuns(..., {perSentence:true})`).
 * Un run neutre (theme/localId nuls) rompt le bloc (B-DEF-2) ; un changement de thème
 * rompt le bloc (B-DEF-3). Complexité O(R), R = nombre de runs (≤ 2N+1).
 */
export function deriveBlocks(runs: Run[]): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  for (const r of runs) {
    if (r.theme == null || r.localId == null) {
      cur = null; // run neutre = rupture de bloc
      continue;
    }
    const contiguous = cur !== null && r.start === cur.end + 1 && r.theme === cur.theme;
    if (contiguous && cur) {
      cur.end = r.end;
      cur.localIds.push(r.localId);
      cur.size += 1;
    } else {
      cur = {
        start: r.start,
        end: r.end,
        theme: r.theme,
        localIds: [r.localId],
        size: 1,
      };
      blocks.push(cur);
    }
  }
  return blocks;
}

/** Bloc couvrant l'index `index` (ou undefined si la phrase n'est pas annotée). */
export function blockAt(blocks: Block[], index: number): Block | undefined {
  return blocks.find((b) => index >= b.start && index <= b.end);
}
