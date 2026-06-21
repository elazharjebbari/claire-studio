/**
 * Vague 2 — point d : validation humaine par phrase + gate de soumission.
 *  - lib/validation : statut par phrase + résumé (complete).
 *  - store : annotation manuelle / adoption = validé ; pré-remplissage = en attente ;
 *    setValidated / validateClauses ; la soumission n'est complète que tout validé.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { validationByIndex, validationSummary } from "@/lib/validation";
import { useWorkspaceStore } from "@/store/workspace";

describe("lib/validation", () => {
  it("classe chaque phrase validated / pending / uncovered", () => {
    const drafts = [
      { localId: "a", anchorIndex: 0, theme: "META", legalNature: null, evidenceSpan: "", rationale: "", certainty: null, validated: true },
      { localId: "b", anchorIndex: 1, theme: "META", legalNature: null, evidenceSpan: "", rationale: "", certainty: null, validated: false },
    ];
    expect(validationByIndex(drafts, 3)).toEqual(["validated", "pending", "uncovered"]);
  });

  it("complete ⇔ ni pending ni uncovered", () => {
    expect(validationSummary(["validated", "validated"]).complete).toBe(true);
    expect(validationSummary(["validated", "pending"]).complete).toBe(false);
    expect(validationSummary(["validated", "uncovered"]).complete).toBe(false);
  });
});

describe("store — validation (point d)", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    useWorkspaceStore.getState().init({ annotationId: "a1", nSentences: 4, clauses: [] });
  });

  it("l'annotation manuelle valide la clause d'office", () => {
    useWorkspaceStore.getState().setBoundary(0, "TERMINATION");
    const d = useWorkspaceStore.getState().draftClauses.find((c) => c.anchorIndex === 0);
    expect(d?.validated).toBe(true);
  });

  it("l'adoption d'un modèle valide la clause", () => {
    useWorkspaceStore.getState().resolveDivergence(1, "mistral", "META");
    const d = useWorkspaceStore.getState().draftClauses.find((c) => c.anchorIndex === 1);
    expect(d?.validated).toBe(true);
  });

  it("le pré-remplissage laisse les clauses NON validées (aide, pas référence)", () => {
    useWorkspaceStore.getState().replacePrefill(
      [{ anchor_index: 0, theme: "META" }] as never,
      "claude",
    );
    const d = useWorkspaceStore.getState().draftClauses.find((c) => c.anchorIndex === 0);
    expect(d?.validated ?? false).toBe(false);
  });

  it("setValidated puis validateClauses (lot) marquent les clauses", () => {
    useWorkspaceStore.getState().setBoundary(0, "META");
    useWorkspaceStore.getState().setBoundary(1, "META");
    const ids = useWorkspaceStore.getState().draftClauses.map((c) => c.localId);
    useWorkspaceStore.getState().validateClauses(ids, false);
    expect(useWorkspaceStore.getState().draftClauses.every((c) => !c.validated)).toBe(true);
    useWorkspaceStore.getState().setValidated(ids[0]!, true);
    expect(useWorkspaceStore.getState().draftClauses.find((c) => c.localId === ids[0])?.validated).toBe(true);
  });
});
