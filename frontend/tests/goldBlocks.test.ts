/**
 * Regroupement en blocs + navigation conflit/non-décidé (PUR).
 */
import { describe, expect, it } from "vitest";
import {
  groupBlocks,
  needsAttention,
  nextConflict,
  prevConflict,
  nextUndecided,
  outlineStats,
} from "@/lib/gold/blocks";
import type { GoldSentenceRow } from "@/lib/gold/types";

const s = (over: Partial<GoldSentenceRow> & { index: number }): GoldSentenceRow => ({
  text: "",
  annotators: [],
  llms: [],
  agreementClass: "strict",
  riskBand: "low",
  autoLevel: "auto_1click",
  confidence: 1,
  humanDissent: false,
  proposedPrimary: "X",
  proposedSecondaries: [],
  decided: false,
  autoResolved: false,
  primary: "",
  secondaries: [],
  decidedBy: null,
  decidedByName: "",
  comment: "",
  ...over,
});

describe("needsAttention", () => {
  it("désaccord ENTRE annotateurs uniquement (la divergence LLM ne compte jamais)", () => {
    expect(needsAttention(s({ index: 0, agreementClass: "strict" }))).toBe(false);
    // Accord strict des annotateurs : pas d'attention même si humanDissent (déprécié) est vrai.
    expect(needsAttention(s({ index: 0, agreementClass: "strict", humanDissent: true }))).toBe(false);
    expect(needsAttention(s({ index: 0, agreementClass: "majority" }))).toBe(true);
    expect(needsAttention(s({ index: 0, agreementClass: "divergence" }))).toBe(true);
  });
});

describe("groupBlocks (factorisation contrat)", () => {
  it("regroupe les phrases contiguës de même clé", () => {
    const blocks = groupBlocks([
      s({ index: 0, decided: true, primary: "META" }),
      s({ index: 1, decided: true, primary: "META" }),
      s({ index: 2, decided: true, primary: "TERMINATION" }),
      s({ index: 3, agreementClass: "divergence" }),
    ]);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ startIndex: 0, endIndex: 1, count: 2, primary: "META" });
    expect(blocks[1]).toMatchObject({ startIndex: 2, endIndex: 2, primary: "TERMINATION" });
    expect(blocks[2]).toMatchObject({ startIndex: 3, count: 1 });
  });

  it("ne fusionne pas par-dessus un trou d'index", () => {
    const blocks = groupBlocks([
      s({ index: 0, decided: true, primary: "META" }),
      s({ index: 2, decided: true, primary: "META" }),
    ]);
    expect(blocks).toHaveLength(2);
  });
});

describe("navigation", () => {
  const list = [
    s({ index: 0, agreementClass: "strict", decided: true, primary: "A" }),
    s({ index: 1, agreementClass: "divergence" }),
    s({ index: 2, agreementClass: "strict", decided: true, primary: "B" }),
    s({ index: 3, agreementClass: "majority" }),
  ];
  it("nextConflict / prevConflict sautent aux phrases à trancher", () => {
    expect(nextConflict(list, -1)).toBe(1);
    expect(nextConflict(list, 1)).toBe(3);
    expect(nextConflict(list, 3)).toBeNull();
    expect(prevConflict(list, 4)).toBe(3);
    expect(prevConflict(list, 1)).toBeNull();
  });
  it("nextUndecided saute aux non décidées", () => {
    expect(nextUndecided(list, -1)).toBe(1);
    expect(nextUndecided(list, 1)).toBe(3);
    expect(nextUndecided(list, 3)).toBeNull();
  });
});

describe("outlineStats", () => {
  it("compte décidées/conflits/à trancher/sans consensus", () => {
    const st = outlineStats([
      s({ index: 0, decided: true, agreementClass: "strict" }),
      s({ index: 1, agreementClass: "divergence", tie: true }),
      // strict + humanDissent (déprécié) → PAS un conflit.
      s({ index: 2, agreementClass: "strict", humanDissent: true }),
    ]);
    // `pending` = la file de travail réelle ; `ties` = les cas où AUCUNE proposition ne
    // fait consensus (la « proposition » du moteur n'y est qu'un départage alphabétique).
    expect(st).toEqual({ total: 3, decided: 1, conflicts: 1, pending: 2, ties: 1 });
  });
});
