/**
 * Rail d'actions rapides — enchaînement « Valider + suivant ».
 *
 * Régression corrigée : le bouton n'est actif que sur une phrase PORTANT une clause, mais on
 * avançait d'UNE phrase. Sur un document réel (ex. Google : 93 phrases, 20 clauses), la
 * phrase suivante n'est presque jamais une clause → le curseur collant déposait la souris sur
 * un bouton désactivé (`cursor-not-allowed`) et l'enchaînement s'arrêtait.
 */

import { describe, expect, it } from "vitest";
import { nextValidatableIndex, validatableIndicesOf } from "@/lib/quickValidate";

describe("validatableIndicesOf", () => {
  it("trie les ancres de clause par index croissant", () => {
    expect(validatableIndicesOf([{ anchorIndex: 12 }, { anchorIndex: 3 }, { anchorIndex: 50 }])).toEqual([
      3, 12, 50,
    ]);
  });

  it("document sans clause → aucune phrase validable", () => {
    expect(validatableIndicesOf([])).toEqual([]);
  });
});

describe("nextValidatableIndex", () => {
  it("saute les phrases sans clause (le bug : on s'arrêtait sur un bouton mort)", () => {
    // 20 clauses réparties sur 93 phrases : après la clause 50, la suivante est 57.
    expect(nextValidatableIndex([0, 4, 50, 57, 88], 50)).toBe(57);
  });

  it("clauses contiguës : avance bien d'une phrase", () => {
    expect(nextValidatableIndex([7, 8, 9], 7)).toBe(8);
  });

  it("dernière clause du document → null (on valide sans avancer)", () => {
    expect(nextValidatableIndex([0, 4, 88], 88)).toBeNull();
  });

  it("aucune clause après la position courante → null", () => {
    expect(nextValidatableIndex([0, 4], 50)).toBeNull();
  });

  it("strictement supérieur : ne se re-cible jamais lui-même (pas de boucle)", () => {
    expect(nextValidatableIndex([50], 50)).toBeNull();
  });

  it("document sans aucune clause → null", () => {
    expect(nextValidatableIndex([], 0)).toBeNull();
  });
});
