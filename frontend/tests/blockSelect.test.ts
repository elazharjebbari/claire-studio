import { describe, expect, it } from "vitest";
import { computeRuns, runAt, clauseRangeBetween, type RunAnchor } from "@/lib/runs";

/**
 * P8 — mapping « plage de phrases → clauses » de la sélection multi-blocs.
 *
 * Scénario : 12 phrases, 3 clauses ancrées en 0 (A), 4 (B), 8 (C).
 *  - run A : [0,3]  · run B : [4,7]  · run C : [8,11]
 */
const anchors: RunAnchor[] = [
  { anchorIndex: 0, theme: "META", localId: "A" },
  { anchorIndex: 4, theme: "TERMINATION", localId: "B" },
  { anchorIndex: 8, theme: "PRIVACY", localId: "C" },
];
const N = 12;

describe("Sélection multi-blocs — mapping phrase→clause (runAt)", () => {
  const runs = computeRuns(anchors, N);

  it("runAt mappe une phrase vers la clause qui la couvre", () => {
    expect(runAt(runs, 0)?.localId).toBe("A");
    expect(runAt(runs, 3)?.localId).toBe("A");
    expect(runAt(runs, 4)?.localId).toBe("B");
    expect(runAt(runs, 7)?.localId).toBe("B");
    expect(runAt(runs, 8)?.localId).toBe("C");
    expect(runAt(runs, 11)?.localId).toBe("C");
  });

  it("une plage interne à une seule clause renvoie une seule clause", () => {
    expect(clauseRangeBetween(runs, 1, 2)).toEqual(["A"]);
    expect(clauseRangeBetween(runs, 8, 11)).toEqual(["C"]);
  });

  it("une plage couvrant deux clauses renvoie les deux localId (ordre des ancres)", () => {
    expect(clauseRangeBetween(runs, 2, 5)).toEqual(["A", "B"]);
    // Ordre des index inversé → même résultat.
    expect(clauseRangeBetween(runs, 5, 2)).toEqual(["A", "B"]);
  });

  it("une plage couvrant les trois clauses renvoie A, B, C", () => {
    expect(clauseRangeBetween(runs, 0, 11)).toEqual(["A", "B", "C"]);
    expect(clauseRangeBetween(runs, 3, 9)).toEqual(["A", "B", "C"]);
  });

  it("le préfixe neutre (sans ancre) n'introduit pas de localId", () => {
    const offset: RunAnchor[] = [
      { anchorIndex: 2, theme: "META", localId: "X" },
      { anchorIndex: 6, theme: "TERMINATION", localId: "Y" },
    ];
    const r = computeRuns(offset, 10);
    // Phrases 0–1 = run neutre (localId null) → ignorées.
    expect(runAt(r, 0)?.localId).toBeNull();
    expect(clauseRangeBetween(r, 0, 1)).toEqual([]);
    expect(clauseRangeBetween(r, 0, 7)).toEqual(["X", "Y"]);
  });
});
