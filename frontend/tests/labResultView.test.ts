/**
 * Routage des vues de résultats ad-hoc (`resultView.ts`) — table exhaustive :
 * chaque preset du plan scientifique route vers sa famille, les replis sont sûrs.
 */

import { describe, expect, it } from "vitest";

import { resultViewFor, AGGREGATED_FAMILIES, type ViewFamily } from "@/features/lab/resultView";

const EXPECTED: Record<string, ViewFamily> = {
  "baseline-fast": "floor",
  "position-only": "floor",
  "llm-judges-baseline": "judges",
  "screening-preprocess": "screening",
  "embeddings-frozen": "paired",
  "learning-curve": "curve",
  "legal-bert-finetune": "flagship",
  "ablation-context": "paired",
  "multilabel-finetune": "multilabel",
  "sequence-boundary": "boundary",
  "knn-explainable": "flagship",
  "encoders-comparison": "paired",
  "ablation-gold-quality": "paired",
  "ablation-label-noise": "curve",
};

describe("resultViewFor", () => {
  it("⭐ les 14 presets du plan routent chacun vers leur famille", () => {
    for (const [preset, family] of Object.entries(EXPECTED)) {
      expect(resultViewFor({ preset, task: "T1_primary" }), preset).toBe(family);
    }
  });

  it("expérience libre T1 → vue générique (jamais bloquée)", () => {
    expect(resultViewFor({ preset: "", task: "T1_primary" })).toBe("generic");
    expect(resultViewFor({ preset: null, task: "T1_primary" })).toBe("generic");
    expect(resultViewFor({ preset: "preset-inconnu", task: "T1_primary" })).toBe("generic");
  });

  it("sans preset, la tâche reste un routage sûr : T2 → multilabel, T3 → boundary", () => {
    expect(resultViewFor({ preset: "", task: "T2_multilabel" })).toBe("multilabel");
    expect(resultViewFor({ preset: "", task: "T3_boundary" })).toBe("boundary");
  });

  it("le preset PRIME sur la tâche (un preset T2 connu ne retombe pas sur le générique T2)", () => {
    expect(resultViewFor({ preset: "multilabel-finetune", task: "T2_multilabel" })).toBe(
      "multilabel",
    );
    expect(resultViewFor({ preset: "sequence-boundary", task: "T3_boundary" })).toBe("boundary");
  });

  it("les familles agrégées sont exactement celles qui portent sur un sweep", () => {
    expect(AGGREGATED_FAMILIES.sort()).toEqual(["curve", "judges", "paired", "screening"]);
  });
});
