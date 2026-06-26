import { describe, expect, it } from "vitest";
import {
  computeRuns,
  coalesceRuns,
  runAt,
  runThemeAt,
  runProvenance,
  segmentsFromRuns,
  nextBoundaryFrom,
  conflictZones,
  type RunAnchor,
  type Run,
} from "@/lib/runs";

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

describe("segmentsFromRuns (réglette Feature A)", () => {
  it("projette les runs porteurs de thème en segments (exclut les neutres)", () => {
    const runs = computeRuns(
      [
        { anchorIndex: 2, theme: "META", localId: "a" },
        { anchorIndex: 5, theme: "TERMINATION", localId: "b" },
      ],
      8,
    ); // forward-fill : [0,1] neutre, [2,4] META, [5,7] TERMINATION
    expect(segmentsFromRuns(runs)).toEqual([
      { startSentence: 2, endSentence: 4, themeCode: "META" },
      { startSentence: 5, endSentence: 7, themeCode: "TERMINATION" },
    ]);
  });

  it("aucun thème → aucun segment", () => {
    expect(segmentsFromRuns(computeRuns([], 5))).toEqual([]);
  });
});

describe("nextBoundaryFrom (D3 — frontière suivante)", () => {
  it("renvoie la prochaine frontière strictement après `from`", () => {
    expect(nextBoundaryFrom([0, 5, 10], 2, 20)).toBe(5);
    expect(nextBoundaryFrom([0, 5, 10], 5, 20)).toBe(10);
  });
  it("renvoie n si aucune frontière au-delà", () => {
    expect(nextBoundaryFrom([0, 5], 5, 20)).toBe(20);
    expect(nextBoundaryFrom([], 3, 20)).toBe(20);
  });
});

describe("conflictZones (D6 — conflits inter-modèles)", () => {
  const m = (segs: Array<{ startSentence: number; endSentence: number; themeCode: string }>) => ({
    segments: segs,
  });
  it("détecte la zone où deux modèles divergent de thème", () => {
    const A = m([{ startSentence: 0, endSentence: 4, themeCode: "META" }]);
    const B = m([{ startSentence: 2, endSentence: 6, themeCode: "TERMINATION" }]);
    // chevauchement 2..4 avec thèmes différents
    expect(conflictZones([A, B], 8)).toEqual([{ start: 2, end: 4 }]);
  });
  it("pas de conflit si même thème, ou un seul modèle couvre", () => {
    const A = m([{ startSentence: 0, endSentence: 4, themeCode: "META" }]);
    const B = m([{ startSentence: 0, endSentence: 4, themeCode: "META" }]);
    expect(conflictZones([A, B], 8)).toEqual([]);
    expect(conflictZones([A], 8)).toEqual([]);
  });
});

describe("coalesceRuns — continuité du rail (suites de même thème fusionnées)", () => {
  it("3 phrases perSentence de MÊME thème → UN seul run continu [0,2]", () => {
    const anchors: RunAnchor[] = [
      { anchorIndex: 0, theme: "META", localId: "a" },
      { anchorIndex: 1, theme: "META", localId: "b" },
      { anchorIndex: 2, theme: "META", localId: "c" },
    ];
    const per = computeRuns(anchors, 3, { perSentence: true });
    expect(per.filter((r) => r.theme === "META").length).toBe(3); // perSentence : 3 runs
    const coalesced = coalesceRuns(per);
    const themed = coalesced.filter((r) => r.theme === "META");
    expect(themed.length).toBe(1); // rail : UN bloc continu
    expect(themed[0]).toMatchObject({ start: 0, end: 2, theme: "META", localId: "a" }); // localId du 1er
  });

  it("changement de thème → DEUX runs (une seule frontière au point de changement)", () => {
    const anchors: RunAnchor[] = [
      { anchorIndex: 0, theme: "META", localId: "a" },
      { anchorIndex: 1, theme: "META", localId: "b" },
      { anchorIndex: 2, theme: "TERMINATION", localId: "c" },
    ];
    const coalesced = coalesceRuns(computeRuns(anchors, 3, { perSentence: true }));
    const themed = coalesced.filter((r) => r.theme != null);
    expect(themed.map((r) => [r.start, r.end, r.theme])).toEqual([
      [0, 1, "META"],
      [2, 2, "TERMINATION"],
    ]);
  });
});

describe("runProvenance (rail : ferme vs suggéré)", () => {
  const run = (start: number, end: number): Run => ({ start, end, theme: "META", localId: "x" });
  it("toutes les phrases validées → firm", () => {
    const m = new Map([
      [0, { validated: true }],
      [1, { validated: true }],
    ]);
    expect(runProvenance(run(0, 1), m)).toBe("firm");
  });
  it("une phrase seedée NON validée dans le bloc → suggested (conservateur)", () => {
    const m = new Map<number, { validated?: boolean; seededFrom?: string | null }>([
      [0, { validated: true }],
      [1, { validated: false, seededFrom: "preannotation:claude" }],
    ]);
    expect(runProvenance(run(0, 1), m)).toBe("suggested");
  });
  it("resolvedFrom (arbitrage adopté) sans validated explicite → firm", () => {
    const m = new Map([[0, { resolvedFrom: "claude" }]]);
    expect(runProvenance(run(0, 0), m)).toBe("firm");
  });
  it("seedée mais validée → firm (la validation prime)", () => {
    const m = new Map([[0, { validated: true, seededFrom: "preannotation:codex" }]]);
    expect(runProvenance(run(0, 0), m)).toBe("firm");
  });
});
