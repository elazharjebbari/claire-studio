import { describe, expect, it } from "vitest";
import { computeRuns, type RunAnchor } from "@/lib/runs";
import { deriveBlocks, blockAt } from "@/lib/blocks";

/** Construit les blocs à partir d'ancres [index, theme] (mode par phrase, C4). */
function blocksFor(anchors: Array<[number, string]>, n: number) {
  const drafts: RunAnchor[] = anchors.map(([anchorIndex, theme], i) => ({
    anchorIndex,
    theme,
    localId: `l${i}`,
  }));
  return deriveBlocks(computeRuns(drafts, n, { perSentence: true }));
}

describe("deriveBlocks / blockAt (Feature B)", () => {
  it("regroupe les phrases contiguës de même thème en un seul bloc", () => {
    const b = blocksFor([[0, "META"], [1, "META"], [2, "META"]], 5);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ start: 0, end: 2, theme: "META", size: 3 });
    expect(b[0]!.localIds).toHaveLength(3);
  });

  it("un trou neutre interrompt le bloc (deux blocs de même thème)", () => {
    const b = blocksFor([[0, "META"], [2, "META"]], 5); // phrase 1 neutre
    expect(b).toHaveLength(2);
    expect(b.map((x) => x.start)).toEqual([0, 2]);
  });

  it("un changement de thème interrompt le bloc", () => {
    const b = blocksFor([[0, "META"], [1, "TERMINATION"], [2, "META"]], 5);
    expect(b).toHaveLength(3);
    expect(b.map((x) => x.theme)).toEqual(["META", "TERMINATION", "META"]);
  });

  it("une phrase isolée est un bloc de taille 1 (pas un cas particulier)", () => {
    const b = blocksFor([[3, "X"]], 5);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ start: 3, end: 3, size: 1 });
  });

  it("blockAt retrouve le bloc couvrant un index, undefined sur phrase neutre", () => {
    const b = blocksFor([[1, "META"], [2, "META"]], 5);
    expect(blockAt(b, 1)?.start).toBe(1);
    expect(blockAt(b, 2)?.start).toBe(1);
    expect(blockAt(b, 0)).toBeUndefined();
    expect(blockAt(b, 4)).toBeUndefined();
  });

  it("aucune clause → aucun bloc", () => {
    expect(blocksFor([], 5)).toEqual([]);
  });

  it("perf (B-PERF-1) : deriveBlocks sur 300 phrases < 5 ms/passe", () => {
    const themes = ["META", "TERMINATION", "PRIVACY_DATA"];
    const drafts: RunAnchor[] = Array.from({ length: 300 }, (_, i) => ({
      anchorIndex: i,
      theme: themes[i % 3]!,
      localId: `l${i}`,
    }));
    const runs = computeRuns(drafts, 300, { perSentence: true });
    const iterations = 50;
    const t0 = performance.now();
    for (let k = 0; k < iterations; k += 1) deriveBlocks(runs);
    const avg = (performance.now() - t0) / iterations;
    expect(avg).toBeLessThan(5);
  });
});
