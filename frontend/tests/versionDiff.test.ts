import { describe, expect, it } from "vitest";
import { buildVersionDiff, diffSnapshots } from "@/lib/versionDiff";
import type { PivotClause, PivotClauseDocument } from "@/types/contract";

function clause(
  anchorIndex: number,
  theme: string,
  overrides: Partial<PivotClause> = {},
): PivotClause {
  return {
    anchor_index: anchorIndex,
    theme,
    legal_nature: null,
    evidence_span: "",
    rationale: "",
    certainty: 2,
    ...overrides,
  };
}

function doc(clauses: PivotClause[]): PivotClauseDocument {
  return {
    doc: "Fitbit",
    project: "claudette-gold-v1",
    annotator: "alice",
    schema: "claire-themes-v1",
    status: "draft",
    global_certainty: 2,
    clauses,
  };
}

describe("diffSnapshots", () => {
  it("détecte les ajouts, suppressions et modifications par anchor_index", () => {
    const from = doc([clause(0, "META"), clause(2, "PREAMBLE_SCOPE"), clause(16, "TERMINATION")]);
    const to = doc([
      clause(0, "META"),
      // anchor 2 reclassé → modifié.
      clause(2, "MODIFICATION_OF_TERMS"),
      // anchor 16 supprimé, anchor 10 ajouté.
      clause(10, "LICENSE_IP"),
    ]);

    const diff = diffSnapshots(from, to);
    const byAnchor = new Map(diff.map((d) => [d.anchorIndex, d]));

    expect(byAnchor.get(0)!.status).toBe("unchanged");
    expect(byAnchor.get(2)!.status).toBe("modified");
    expect(byAnchor.get(2)!.changedFields).toContain("theme");
    expect(byAnchor.get(10)!.status).toBe("added");
    expect(byAnchor.get(16)!.status).toBe("removed");
  });

  it("est trié par anchor_index croissant", () => {
    const from = doc([clause(5, "META")]);
    const to = doc([clause(1, "PREAMBLE_SCOPE"), clause(5, "META")]);
    const diff = diffSnapshots(from, to);
    expect(diff.map((d) => d.anchorIndex)).toEqual([1, 5]);
  });

  it("liste précisément les champs modifiés", () => {
    const from = doc([clause(0, "META", { certainty: 1, rationale: "a" })]);
    const to = doc([clause(0, "META", { certainty: 3, rationale: "b" })]);
    const diff = diffSnapshots(from, to);
    expect(diff[0]!.status).toBe("modified");
    expect(diff[0]!.changedFields).toEqual(
      expect.arrayContaining(["certainty", "rationale"]),
    );
    expect(diff[0]!.changedFields).not.toContain("theme");
  });
});

describe("buildVersionDiff", () => {
  it("agrège un résumé cohérent (added/removed/modified/unchanged)", () => {
    const from = { number: 1, label: "v1", snapshot: doc([clause(0, "META"), clause(2, "PREAMBLE_SCOPE")]) };
    const to = {
      number: 2,
      label: "v2",
      snapshot: doc([clause(0, "META"), clause(2, "TERMINATION"), clause(7, "PRIVACY_DATA")]),
    };
    const result = buildVersionDiff("ann-1", from, to);
    expect(result.summary).toEqual({ added: 1, removed: 0, modified: 1, unchanged: 1 });
    expect(result.from.number).toBe(1);
    expect(result.to.number).toBe(2);
    expect(result.annotationId).toBe("ann-1");
  });
});
