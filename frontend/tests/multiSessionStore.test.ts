/**
 * Étanchéité des sessions côté CLIENT (store workspace) — composante frontend de la
 * batterie multi-annotation. Vérifie : (1) reset() vide TOUT entre deux sessions (zéro
 * bleed d'une session à l'autre) ; (2) readOnly (consultation de la session d'un AUTRE)
 * neutralise TOUS les mutateurs de contenu → impossible de corrompre la session d'autrui.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceStore } from "@/store/workspace";
import type { Clause } from "@/types/contract";

const S = () => useWorkspaceStore.getState();
const clause = (id: string, anchorIndex: number, theme: string): Clause => ({
  id,
  annotationId: "a",
  anchorIndex,
  theme,
  order: anchorIndex,
});

beforeEach(() => S().reset());

describe("Étanchéité des sessions (store)", () => {
  it("reset() vide entièrement l'état → aucune fuite vers la session suivante", () => {
    S().init({ annotationId: "annA", nSentences: 10, clauses: [clause("c1", 0, "META")] });
    S().setBoundary(2, "TERMINATION");
    expect(S().draftClauses.length).toBe(2);
    expect(S().annotationId).toBe("annA");

    // Nouvelle session (autre annotateur / autre document) : init la remplace.
    S().init({ annotationId: "annB", nSentences: 5, clauses: [] });
    expect(S().annotationId).toBe("annB");
    expect(S().draftClauses).toEqual([]); // ZÉRO clause héritée de annA
    expect(S().undoStack).toEqual([]);
    expect(S().redoStack).toEqual([]);
    expect(S().selectedSentences).toEqual([]);
    expect(S().actionLog).toEqual([]);
  });

  it("readOnly neutralise TOUS les mutateurs de contenu (lecture d'une session d'autrui)", () => {
    S().init({
      annotationId: "peer",
      nSentences: 10,
      clauses: [clause("c1", 0, "META"), clause("c2", 4, "TERMINATION")],
      readOnly: true,
    });
    const snapshot = JSON.stringify(S().draftClauses);

    // Toute tentative d'écriture doit être un NO-OP.
    S().setBoundary(1, "MISC_BOILERPLATE");
    S().toggleBoundary(0, "META");
    S().applyBlockOp({ kind: "annotateRange", anchors: [1, 2, 3], theme: "TERMINATION" });
    S().removeBoundary(0);
    const first = S().draftClauses[0];
    if (first) {
      S().updateDraft(first.localId, { theme: "MISC_BOILERPLATE", rationale: "x" });
      S().setCertainty(first.localId, 3);
      S().setValidated(first.localId, true);
    }
    S().resolveDivergence(2, "mistral", "TERMINATION");
    S().undo();
    S().redo();

    expect(JSON.stringify(S().draftClauses)).toBe(snapshot); // INTACT — aucune corruption
    expect(S().dirty).toBe(false); // jamais marqué sale
  });

  it("une session éditable reste pleinement mutable (contrôle positif)", () => {
    S().init({ annotationId: "mine", nSentences: 10, clauses: [], readOnly: false });
    S().setBoundary(3, "TERMINATION");
    expect(S().draftClauses.map((c) => c.anchorIndex)).toEqual([3]);
    expect(S().dirty).toBe(true);
  });
});
