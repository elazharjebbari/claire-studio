import { describe, expect, it } from "vitest";
import { computeRuns, runAt, runThemeAt, type RunAnchor } from "@/lib/runs";

describe("computeRuns", () => {
  it("préfixe neutre quand la 1re ancre n'est pas en 0", () => {
    const drafts: RunAnchor[] = [
      { anchorIndex: 3, theme: "TERMINATION", localId: "a" },
    ];
    const runs = computeRuns(drafts, 6);
    expect(runs).toEqual([
      { start: 0, end: 2, theme: null, localId: null },
      { start: 3, end: 5, theme: "TERMINATION", localId: "a" },
    ]);
  });

  it("pas de préfixe neutre quand une ancre est en 0, runs contigus", () => {
    const drafts: RunAnchor[] = [
      { anchorIndex: 0, theme: "META", localId: "a" },
      { anchorIndex: 4, theme: "ARBITRATION_DISPUTES", localId: "b" },
    ];
    const runs = computeRuns(drafts, 8);
    expect(runs).toEqual([
      { start: 0, end: 3, theme: "META", localId: "a" },
      { start: 4, end: 7, theme: "ARBITRATION_DISPUTES", localId: "b" },
    ]);
    // Contigus, sans trou ni chevauchement.
    expect(runs[0]!.end + 1).toBe(runs[1]!.start);
  });

  it("trie par anchorIndex et déduplique les ancres dupliquées", () => {
    const drafts: RunAnchor[] = [
      { anchorIndex: 5, theme: "B", localId: "b" },
      { anchorIndex: 0, theme: "A", localId: "a" },
      { anchorIndex: 5, theme: "DUP", localId: "dup" },
    ];
    const runs = computeRuns(drafts, 8);
    expect(runs.map((r) => r.start)).toEqual([0, 5]);
    expect(runs[1]!.theme).toBe("B"); // 1re ancre à l'index 5 gagne
  });

  it("ignore les ancres hors bornes et retourne [] si nSentences<=0", () => {
    expect(computeRuns([{ anchorIndex: 99, theme: "X", localId: "x" }], 3)).toEqual([
      { start: 0, end: 2, theme: null, localId: null },
    ]);
    expect(computeRuns([], 0)).toEqual([]);
  });
});

describe("computeRuns — perSentence (C4 : pas de débordement)", () => {
  it("une clause ne couvre QUE sa phrase ; le reste est neutre", () => {
    const runs = computeRuns(
      [{ anchorIndex: 2, theme: "TERMINATION", localId: "a" }],
      5,
      { perSentence: true },
    );
    expect(runs).toEqual([
      { start: 0, end: 1, theme: null, localId: null },
      { start: 2, end: 2, theme: "TERMINATION", localId: "a" },
      { start: 3, end: 4, theme: null, localId: null },
    ]);
    // La phrase 3 (et au-delà) n'hérite PAS du thème de la clause posée en 2.
    expect(runThemeAt(runs, 2)).toBe("TERMINATION");
    expect(runThemeAt(runs, 3)).toBeNull();
    expect(runThemeAt(runs, 4)).toBeNull();
  });

  it("plusieurs clauses → une phrase chacune, trous neutres entre elles", () => {
    const runs = computeRuns(
      [
        { anchorIndex: 0, theme: "META", localId: "a" },
        { anchorIndex: 2, theme: "TERMINATION", localId: "b" },
      ],
      4,
      { perSentence: true },
    );
    expect(runs).toEqual([
      { start: 0, end: 0, theme: "META", localId: "a" },
      { start: 1, end: 1, theme: null, localId: null },
      { start: 2, end: 2, theme: "TERMINATION", localId: "b" },
      { start: 3, end: 3, theme: null, localId: null },
    ]);
  });
});

describe("runAt / runThemeAt", () => {
  const runs = computeRuns(
    [
      { anchorIndex: 0, theme: "META", localId: "a" },
      { anchorIndex: 3, theme: "TERMINATION", localId: "b" },
    ],
    6,
  );

  it("runThemeAt renvoie le thème du run couvrant l'index", () => {
    expect(runThemeAt(runs, 0)).toBe("META");
    expect(runThemeAt(runs, 2)).toBe("META");
    expect(runThemeAt(runs, 3)).toBe("TERMINATION");
    expect(runThemeAt(runs, 5)).toBe("TERMINATION");
  });

  it("runAt renvoie undefined hors de tout run", () => {
    expect(runAt(runs, 99)).toBeUndefined();
    expect(runThemeAt(runs, 99)).toBeNull();
  });

  it("run neutre → thème null", () => {
    const withPrefix = computeRuns([{ anchorIndex: 2, theme: "X", localId: "a" }], 4);
    expect(runThemeAt(withPrefix, 0)).toBeNull();
    expect(runThemeAt(withPrefix, 2)).toBe("X");
  });
});
