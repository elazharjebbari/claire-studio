import { describe, expect, it } from "vitest";
import { coverageGaps, uncoveredCount, nextUncovered } from "@/lib/planCoverage";

describe("coverageGaps", () => {
  it("reproduit le cas Academia : 0..132 annotées sur 193 → 1 trou 133..192", () => {
    const anchors = Array.from({ length: 133 }, (_, i) => i); // 0..132
    const gaps = coverageGaps(anchors, 193);
    expect(gaps).toEqual([{ start: 133, end: 192, count: 60 }]);
    expect(uncoveredCount(anchors, 193)).toBe(60);
  });

  it("détecte des trous internes multiples", () => {
    // annotées : 0, 3, 4 ; n=7 → trous 1..2, 5..6
    const gaps = coverageGaps([0, 3, 4], 7);
    expect(gaps).toEqual([
      { start: 1, end: 2, count: 2 },
      { start: 5, end: 6, count: 2 },
    ]);
  });

  it("aucun trou quand tout est couvert", () => {
    expect(coverageGaps([0, 1, 2], 3)).toEqual([]);
    expect(uncoveredCount([0, 1, 2], 3)).toBe(0);
  });

  it("défensif : n<=0 → vide ; ancres hors bornes ignorées", () => {
    expect(coverageGaps([0], 0)).toEqual([]);
    expect(coverageGaps([99, -1], 3)).toEqual([{ start: 0, end: 2, count: 3 }]);
  });
});

describe("nextUncovered (navigation cyclique)", () => {
  it("trouve la prochaine phrase non annotée après `from`", () => {
    const anchors = Array.from({ length: 133 }, (_, i) => i); // 0..132
    expect(nextUncovered(anchors, 193, 132)).toBe(133);
    expect(nextUncovered(anchors, 193, 150)).toBe(151);
    // après la dernière (192) → boucle vers le 1er trou (133)
    expect(nextUncovered(anchors, 193, 192)).toBe(133);
  });

  it("from=-1 démarre au tout début", () => {
    expect(nextUncovered([0, 1], 5, -1)).toBe(2);
  });

  it("null si tout est annoté", () => {
    expect(nextUncovered([0, 1, 2], 3, 0)).toBeNull();
  });
});
