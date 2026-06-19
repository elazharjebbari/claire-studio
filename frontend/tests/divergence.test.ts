import { describe, expect, it } from "vitest";
import {
  divergenceAnchors,
  divergenceIndices,
  divergenceOrdinal,
  divergenceSegments,
  isDivergent,
  nextDivergence,
  prevDivergence,
} from "@/lib/divergence";

describe("divergence (pur)", () => {
  // Claude :  [A, A, B, B, C]    Codex : [A, X, B, null, C]
  const claude = ["A", "A", "B", "B", "C"];
  const codex = ["A", "X", "B", null, "C"];

  it("isDivergent : deux thèmes présents et différents", () => {
    expect(isDivergent(claude, codex, 0)).toBe(false); // A == A
    expect(isDivergent(claude, codex, 1)).toBe(true); // A != X
    expect(isDivergent(claude, codex, 3)).toBe(false); // codex null → pas une divergence stricte
  });

  it("divergenceIndices ne retient que les désaccords stricts", () => {
    expect(divergenceIndices(claude, codex)).toEqual([1]);
  });

  it("divergenceSegments regroupe les indices contigus", () => {
    const a = ["A", "B", "C", "D"];
    const b = ["X", "Y", "C", "Z"]; // divergences en 0,1,3 → segments [0-1] et [3-3]
    expect(divergenceSegments(a, b)).toEqual([
      { start: 0, end: 1 },
      { start: 3, end: 3 },
    ]);
    expect(divergenceAnchors(a, b)).toEqual([0, 3]);
  });

  it("next/prevDivergence bouclent correctement", () => {
    const anchors = [2, 5, 9];
    expect(nextDivergence(anchors, 0)).toBe(2);
    expect(nextDivergence(anchors, 2)).toBe(5);
    expect(nextDivergence(anchors, 9)).toBe(2); // boucle
    expect(prevDivergence(anchors, 9)).toBe(5);
    expect(prevDivergence(anchors, 2)).toBe(9); // boucle
    expect(nextDivergence([], 3)).toBeNull();
    expect(prevDivergence([], 3)).toBeNull();
  });

  it("divergenceOrdinal donne la position 1-based ou 0 hors ancre", () => {
    const anchors = [2, 5, 9];
    expect(divergenceOrdinal(anchors, 5)).toBe(2);
    expect(divergenceOrdinal(anchors, 4)).toBe(0);
  });

  it("tolère des tableaux de longueurs différentes", () => {
    expect(divergenceIndices(["A", "B"], ["A"])).toEqual([]); // index 1 : codex absent
    expect(divergenceIndices(["A", "B"], ["A", "C"])).toEqual([1]);
  });
});
