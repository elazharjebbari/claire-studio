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
    validated: partial.validated ?? false,
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
    validated: p.validated ?? false,
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

  it("détecte une mise à jour quand SEULE la validation change (point d)", () => {
    const plan = planClauseSync(
      [draft({ anchorIndex: 0, theme: "META", serverId: "c1", validated: true })],
      [persisted({ anchorIndex: 0, serverId: "c1", theme: "META", validated: false })],
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]!.draft.validated).toBe(true);
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

describe("planClauseSync — multi-label / frontière / niveau (triage)", () => {
  const prim = { label: "TERMINATION", role: "primary" as const, support: 3 };
  const sec = { label: "META", role: "secondary" as const, support: 1 };

  it("ajouter un ensemble multi-label sur une clause persistée mono → UPDATE", () => {
    const p = persisted({ anchorIndex: 0, serverId: "c0", theme: "TERMINATION" });
    const d = { ...draft({ anchorIndex: 0, serverId: "c0", theme: "TERMINATION" }), themes: [prim, sec] };
    const plan = planClauseSync([d], [p]);
    expect(plan.updates).toHaveLength(1);
    expect(plan.creates).toHaveLength(0);
  });

  it("changer la frontière (hard→soft) → UPDATE", () => {
    const base = { anchorIndex: 0, serverId: "c0", theme: "META" };
    const p = { ...persisted(base), boundary: { type: "hard" as const, support: 3 } };
    const d = { ...draft(base), boundary: { type: "soft" as const, support: 2 } };
    expect(planClauseSync([d], [p]).updates).toHaveLength(1);
  });

  it("changer le niveau de triage → UPDATE", () => {
    const base = { anchorIndex: 0, serverId: "c0", theme: "META" };
    const p = { ...persisted(base), triageLevel: "C2" as const };
    const d = { ...draft(base), triageLevel: "C1" as const };
    expect(planClauseSync([d], [p]).updates).toHaveLength(1);
  });

  it("même ensemble dans un ordre différent → AUCUN diff (clé canonique)", () => {
    const base = { anchorIndex: 0, serverId: "c0", theme: "TERMINATION" };
    const p = { ...persisted(base), themes: [prim, sec] };
    const d = { ...draft(base), themes: [sec, prim] }; // ordre inversé
    expect(isEmptyPlan(planClauseSync([d], [p]))).toBe(true);
  });

  it("clause mono locale (themes/boundary absents) == clause mono serveur (défauts) → AUCUN diff", () => {
    // Régression : le serveur renvoie toujours themes=[{primary,0}] et boundary={hard,1} ;
    // un draft mono local les a en `undefined`. Les défauts triviaux doivent être neutres
    // (sinon PATCH parasite à chaque tick sur toute clause manuelle).
    const d = draft({ anchorIndex: 0, serverId: "c0", theme: "META" }); // themes/boundary undefined
    const p = {
      ...persisted({ anchorIndex: 0, serverId: "c0", theme: "META" }),
      themes: [{ label: "META", role: "primary" as const, support: 0 }],
      boundary: { type: "hard" as const, support: 1 },
    };
    expect(isEmptyPlan(planClauseSync([d], [p]))).toBe(true);
  });

  it("espaces de BORDURE dans evidenceSpan/rationale → AUCUN diff (le serveur ébarbe)", () => {
    // Régression du bug « Des modifications ne sont pas encore enregistrées » (soumission
    // bloquée) : DRF trim_whitespace ébarbe à l'écriture → le serveur renvoie la valeur
    // ébarbée, le brouillon garde la saisie brute. Sans normalisation, le diff serait
    // ÉTERNEL et flush() ne convergerait jamais.
    const d = draft({
      anchorIndex: 0, serverId: "c0", theme: "META",
      evidenceSpan: "  may terminate  ", rationale: "\nclause de résiliation \t",
    });
    const p = persisted({
      anchorIndex: 0, serverId: "c0", theme: "META",
      evidenceSpan: "may terminate", rationale: "clause de résiliation", // ébarbés (serveur)
    });
    expect(isEmptyPlan(planClauseSync([d], [p]))).toBe(true);
  });

  it("draftsToPersisted conserve themes/boundary/triageLevel", () => {
    const d = {
      ...draft({ anchorIndex: 0, serverId: "c0", theme: "TERMINATION" }),
      themes: [prim, sec], boundary: { type: "soft" as const, support: 2 }, triageLevel: "C3" as const,
    };
    const out = draftsToPersisted([d]);
    expect(out[0]!.themes).toHaveLength(2);
    expect(out[0]!.boundary).toEqual({ type: "soft", support: 2 });
    expect(out[0]!.triageLevel).toBe("C3");
  });
});
