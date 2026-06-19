import { describe, expect, it } from "vitest";
import {
  draftsToPersisted,
  isEmptyPlan,
  planClauseSync,
  type PersistedClause,
} from "@/lib/autosave";
import type { DraftClause } from "@/store/workspace";

function draft(partial: Partial<DraftClause> & { anchorIndex: number }): DraftClause {
  return {
    localId: `local-${partial.anchorIndex}`,
    anchorIndex: partial.anchorIndex,
    theme: partial.theme ?? "META",
    legalNature: partial.legalNature ?? null,
    evidenceSpan: partial.evidenceSpan ?? "",
    rationale: partial.rationale ?? "",
    certainty: partial.certainty ?? null,
    serverId: partial.serverId,
  };
}

function persisted(p: Partial<PersistedClause> & { anchorIndex: number; serverId: string }): PersistedClause {
  return {
    anchorIndex: p.anchorIndex,
    serverId: p.serverId,
    theme: p.theme ?? "META",
    legalNature: p.legalNature ?? null,
    evidenceSpan: p.evidenceSpan ?? "",
    rationale: p.rationale ?? "",
    certainty: p.certainty ?? null,
  };
}

describe("planClauseSync (diff d'auto-save par ancre)", () => {
  it("détecte une création (ancre absente côté serveur)", () => {
    const plan = planClauseSync([draft({ anchorIndex: 3, theme: "TERMINATION" })], []);
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0]!.anchorIndex).toBe(3);
    expect(plan.updates).toHaveLength(0);
    expect(plan.deletes).toHaveLength(0);
  });

  it("détecte une mise à jour (même ancre, thème changé) avec le bon serverId", () => {
    const plan = planClauseSync(
      [draft({ anchorIndex: 0, theme: "TERMINATION", serverId: "c1" })],
      [persisted({ anchorIndex: 0, serverId: "c1", theme: "META" })],
    );
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toEqual([
      { serverId: "c1", draft: expect.objectContaining({ anchorIndex: 0, theme: "TERMINATION" }) },
    ]);
    expect(plan.deletes).toHaveLength(0);
  });

  it("détecte une suppression (ancre serveur absente du brouillon)", () => {
    const plan = planClauseSync([], [persisted({ anchorIndex: 5, serverId: "c9" })]);
    expect(plan.deletes).toEqual(["c9"]);
  });

  it("ne propose rien quand brouillon = serveur (no-op)", () => {
    const same = { anchorIndex: 2, theme: "PRIVACY_DATA", certainty: 2 as const };
    const plan = planClauseSync(
      [draft({ ...same, serverId: "c2" })],
      [persisted({ ...same, serverId: "c2" })],
    );
    expect(isEmptyPlan(plan)).toBe(true);
  });

  it("draftsToPersisted ne garde que les clauses ayant un serverId", () => {
    const out = draftsToPersisted([
      draft({ anchorIndex: 0, serverId: "c1" }),
      draft({ anchorIndex: 1 }), // pas encore persistée
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.serverId).toBe("c1");
  });
});
