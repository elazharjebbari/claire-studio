/**
 * Vague 2 — point e : comparaison N-way (2 ou 3 juges).
 *  - agreementSegments généralisée : accord / conflit (≥2 thèmes) / partiel.
 *    La sélection des modèles est pilotée par la réglette (gutterModels), pas un store dédié.
 */

import { describe, expect, it } from "vitest";
import { agreementSegments } from "@/components/workspace/ComparePanel";

describe("agreementSegments (N-way)", () => {
  it("3 juges d'accord → un segment 'agree'", () => {
    const segs = agreementSegments([
      ["A", "A", "A"],
      ["A", "A", "A"],
      ["A", "A", "A"],
    ], 3, 3);
    expect(segs).toEqual([{ start: 0, end: 2, status: "agree" }]);
  });

  it("≥2 thèmes distincts → 'diverge' (conflit)", () => {
    const segs = agreementSegments([
      ["A", "A"],
      ["A", "B"],
      ["A", "A"],
    ], 3, 2);
    expect(segs[0]).toEqual({ start: 0, end: 0, status: "agree" });
    expect(segs[1]).toEqual({ start: 1, end: 1, status: "diverge" });
  });

  it("couverture incomplète mais accord → 'partial'", () => {
    const segs = agreementSegments([
      ["A", "A"],
      ["A", null],
      ["A", "A"],
    ], 3, 2);
    expect(segs[0]).toEqual({ start: 0, end: 0, status: "agree" });
    expect(segs[1]).toEqual({ start: 1, end: 1, status: "partial" });
  });

  it("phrase couverte par personne → ignorée", () => {
    const segs = agreementSegments([
      [null, "A"],
      [null, "A"],
    ], 2, 2);
    expect(segs).toEqual([{ start: 1, end: 1, status: "agree" }]);
  });
});
