import { describe, expect, it } from "vitest";
import { buildTriageItems } from "@/lib/triage/useTriage";
import type { PreAnnotation } from "@/types/contract";

/** Fabrique une PreAnnotation d'un juge à partir de (anchorIndex, themeCode). */
function pre(judge: string, clauses: [number, string][]): PreAnnotation {
  return {
    judge,
    schemaVersion: "v9.2",
    clauses: clauses.map(([anchorIndex, themeCode]) => ({ anchorIndex, themeCode })),
  } as PreAnnotation;
}

describe("buildTriageItems — forward-fill + frontière + couverture", () => {
  const preByJudge = {
    claude: pre("claude", [[0, "PREAMBLE_SCOPE"], [2, "ACCEPTABLE_USE"]]),
    codex: pre("codex", [[0, "PREAMBLE_SCOPE"], [2, "ACCEPTABLE_USE"]]),
    mistral: pre("mistral", [[0, "PREAMBLE_SCOPE"], [2, "LICENSE_IP"]]),
  };

  it("phrase 0 : unanime + frontière dure (3 ancres) → C1", () => {
    const items = buildTriageItems(preByJudge, 6);
    expect(items[0]!.result?.level).toBe("C1");
    expect(items[0]!.result?.boundary.type).toBe("hard");
  });

  it("phrase 1 : forward-fill unanime, aucune ancre → C2 (frontière molle)", () => {
    const items = buildTriageItems(preByJudge, 6);
    expect(items[1]!.result?.level).toBe("C2");
    expect(items[1]!.result?.boundary).toEqual({ type: "soft", support: 0 });
  });

  it("phrase 2 : couple de cluster (ACCEPTABLE_USE×2 / LICENSE_IP) → C3, primaire LICENSE_IP", () => {
    const items = buildTriageItems(preByJudge, 6);
    const r = items[2]!.result!;
    expect(r.level).toBe("C3");
    expect(r.labels.find((l) => l.role === "primary")!.label).toBe("LICENSE_IP");
    expect(r.labels.find((l) => l.role === "secondary")!.label).toBe("ACCEPTABLE_USE");
  });

  it("couverture < 2 juges → result null (carte masquée)", () => {
    const sparse = {
      claude: pre("claude", [[0, "PREAMBLE_SCOPE"]]),
      codex: pre("codex", [[4, "TERMINATION"]]),
      mistral: pre("mistral", [[4, "TERMINATION"]]),
    };
    const items = buildTriageItems(sparse, 6);
    // phrases 0..3 : seul claude couvre → null ; phrases 4..5 : 3 juges → non null.
    expect(items[0]!.result).toBeNull();
    expect(items[3]!.result).toBeNull();
    expect(items[4]!.result).not.toBeNull();
  });

  it("n=0 → aucun item", () => {
    expect(buildTriageItems(preByJudge, 0)).toEqual([]);
  });
});
