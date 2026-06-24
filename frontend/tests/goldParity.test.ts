/**
 * Parité front/back du moteur de scoring GOLD : TS == golden partagé
 * (voir backend/tests/test_gold_parity.py pour Python == golden).
 */
import { describe, expect, it } from "vitest";
import golden from "@/lib/gold/golden.cases.json";
import { scoreSentence, type Vote, type ScoringConfig } from "@/lib/goldScoring";

// Le golden stocke la config en clés Python (snake_case) → on mappe vers ScoringConfig.
function mapConfig(c: Record<string, unknown>): Partial<ScoringConfig> {
  const out: Partial<ScoringConfig> = {};
  if (c.llm_role !== undefined) out.llmRole = c.llm_role as ScoringConfig["llmRole"];
  if (c.llm_weight !== undefined) out.llmWeight = c.llm_weight as number;
  if (c.annotator_weight !== undefined) out.annotatorWeight = c.annotator_weight as number;
  if (c.per_annotator !== undefined) out.perAnnotator = c.per_annotator as Record<string, number>;
  if (c.per_llm !== undefined) out.perLlm = c.per_llm as Record<string, number>;
  if (c.secondary_min_annotators !== undefined)
    out.secondaryMinAnnotators = c.secondary_min_annotators as number;
  if (c.reliability !== undefined) out.reliability = c.reliability as Record<string, number>;
  return out;
}

describe("parité moteur GOLD (TS == golden partagé)", () => {
  it("golden présent et versionné", () => {
    expect((golden as { engineVersion: number }).engineVersion).toBe(1);
    expect((golden as { cases: unknown[] }).cases.length).toBeGreaterThanOrEqual(15);
  });

  for (const c of (golden as { cases: Array<Record<string, unknown>> }).cases) {
    it(`cas ${c.id}`, () => {
      const votes = c.votes as Vote[];
      const cfg = mapConfig((c.config ?? {}) as Record<string, unknown>);
      const s = scoreSentence(votes, cfg);
      const exp = c.expect as Record<string, unknown>;
      expect(s.primary).toBe(exp.primary);
      expect(s.secondaries).toEqual(exp.secondaries);
      expect(s.agreementClass).toBe(exp.agreementClass);
      expect(s.confidence).toBe(exp.confidence);
      expect(s.riskBand).toBe(exp.riskBand);
      expect(s.humanDissent).toBe(exp.humanDissent);
      expect(s.humanBlock).toBe(exp.humanBlock);
      expect(s.llmBlock).toBe(exp.llmBlock);
      expect(s.autoLevel).toBe(exp.autoLevel);
    });
  }
});
