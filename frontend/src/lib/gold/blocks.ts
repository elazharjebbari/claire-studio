/**
 * Regroupement en BLOCS façon contrat + navigation conflit→conflit (PUR, testable).
 *
 * - Les phrases CONTIGUËS de même clé (décidé→thème gold ; sinon classe d'accord) sont
 *   factorisées en un bloc unique (lecture juridique aérée).
 * - Navigation : sauter à la prochaine/précédente phrase « à trancher » (conflit) ou
 *   non décidée, sans bouger la souris (le panneau scrolle la cible sous le curseur).
 */
import type { GoldSentenceRow } from "./types";

/** Une phrase « mérite attention » = désaccord ENTRE ANNOTATEURS (jamais vis-à-vis des LLM). */
export function needsAttention(s: GoldSentenceRow): boolean {
  return s.agreementClass !== "strict";
}

/** Clé de bloc : si décidée → le thème gold ; sinon la classe d'accord (+ dissent). */
export function blockKey(s: GoldSentenceRow): string {
  if (s.decided && s.primary) return `decided:${s.primary}`;
  return `${s.agreementClass}${s.humanDissent ? ":dissent" : ""}`;
}

export interface GoldBlock {
  startIndex: number;
  endIndex: number;
  key: string;
  decided: boolean;
  /** thème gold du bloc (si décidé et homogène), sinon "" */
  primary: string;
  agreementClass: GoldSentenceRow["agreementClass"];
  count: number;
  indices: number[];
}

/** Factorise les phrases contiguës de même clé en blocs (ordre conservé). */
export function groupBlocks(sentences: GoldSentenceRow[]): GoldBlock[] {
  const blocks: GoldBlock[] = [];
  for (const s of sentences) {
    const key = blockKey(s);
    const last = blocks[blocks.length - 1];
    if (last && last.key === key && last.endIndex === s.index - 1) {
      last.endIndex = s.index;
      last.count += 1;
      last.indices.push(s.index);
    } else {
      blocks.push({
        startIndex: s.index,
        endIndex: s.index,
        key,
        decided: s.decided,
        primary: s.decided ? s.primary : "",
        agreementClass: s.agreementClass,
        count: 1,
        indices: [s.index],
      });
    }
  }
  return blocks;
}

function findIndex(
  sentences: GoldSentenceRow[],
  from: number,
  dir: 1 | -1,
  predicate: (s: GoldSentenceRow) => boolean,
): number | null {
  // ordre par index croissant garanti côté serveur, mais on sécurise via une map.
  const byIndex = new Map(sentences.map((s) => [s.index, s]));
  const max = sentences.reduce((m, s) => Math.max(m, s.index), -1);
  for (let i = from + dir; i >= 0 && i <= max; i += dir) {
    const s = byIndex.get(i);
    if (s && predicate(s)) return i;
  }
  return null;
}

/** Prochaine phrase à trancher (conflit) strictement après `from` (null si aucune). */
export function nextConflict(sentences: GoldSentenceRow[], from: number): number | null {
  return findIndex(sentences, from, 1, needsAttention);
}

export function prevConflict(sentences: GoldSentenceRow[], from: number): number | null {
  return findIndex(sentences, from, -1, needsAttention);
}

/** Prochaine phrase NON décidée (pour la validation successive). */
export function nextUndecided(sentences: GoldSentenceRow[], from: number): number | null {
  return findIndex(sentences, from, 1, (s) => !s.decided);
}

export function prevUndecided(sentences: GoldSentenceRow[], from: number): number | null {
  return findIndex(sentences, from, -1, (s) => !s.decided);
}

/** Phrase « à trancher à la main » : non décidée APRÈS auto-résolution.
 *
 * C'est le critère de la FILE DE TRAVAIL, et il porte sur l'ÉTAT (`decided`), jamais sur
 * `autoLevel` qui n'est qu'une propriété du score : une phrase `auto` non appliquée
 * (configuration, complétude) doit rester dans la file. Sur la campagne, après
 * auto-résolution, cela désigne exactement les 462 arbitrages réels — contre ~5 000
 * phrases si l'on naviguait sur `agreementClass !== "strict"`. */
export function isTodo(s: GoldSentenceRow): boolean {
  return !s.decided;
}

export function nextTodo(sentences: GoldSentenceRow[], from: number): number | null {
  return findIndex(sentences, from, 1, isTodo);
}

export function prevTodo(sentences: GoldSentenceRow[], from: number): number | null {
  return findIndex(sentences, from, -1, isTodo);
}

export interface OutlineStats {
  total: number;
  decided: number;
  conflicts: number; // désaccord entre annotateurs (y compris déjà auto-résolu)
  pending: number; // non décidées = la FILE DE TRAVAIL réelle
  ties: number; // égalités non tranchées : aucune proposition ne fait consensus
}

export function outlineStats(sentences: GoldSentenceRow[]): OutlineStats {
  let decided = 0;
  let conflicts = 0;
  let pending = 0;
  let ties = 0;
  for (const s of sentences) {
    if (s.decided) decided++;
    else pending++;
    if (needsAttention(s)) conflicts++;
    if (!s.decided && s.tie) ties++;
  }
  return { total: sentences.length, decided, conflicts, pending, ties };
}
