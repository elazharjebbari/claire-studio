import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceStore } from "@/store/workspace";
import type { Clause } from "@/types/contract";

const baseClauses: Clause[] = [
  { id: "c1", annotationId: "ann-1", anchorIndex: 0, theme: "META", order: 0 },
];

describe("workspace store", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    useWorkspaceStore
      .getState()
      .init({ annotationId: "ann-1", nSentences: 10, clauses: baseClauses });
  });

  it("initialise à partir des clauses serveur", () => {
    const s = useWorkspaceStore.getState();
    expect(s.draftClauses).toHaveLength(1);
    expect(s.selectedClauseId).toBe("c1");
    expect(s.dirty).toBe(false);
  });

  it("déplace le focus dans les bornes", () => {
    const { moveFocus } = useWorkspaceStore.getState();
    moveFocus(-1);
    expect(useWorkspaceStore.getState().focusedSentence).toBe(0);
    moveFocus(3);
    expect(useWorkspaceStore.getState().focusedSentence).toBe(3);
    moveFocus(100);
    expect(useWorkspaceStore.getState().focusedSentence).toBe(9);
  });

  it("pose une frontière de clause (B / clic) et marque dirty", () => {
    useWorkspaceStore.getState().setBoundary(5, "TERMINATION");
    const s = useWorkspaceStore.getState();
    expect(s.draftClauses).toHaveLength(2);
    expect(s.dirty).toBe(true);
    expect(s.draftClauses.find((c) => c.anchorIndex === 5)?.theme).toBe("TERMINATION");
  });

  it("ne crée pas deux ancres sur la même phrase", () => {
    // setBoundary exige désormais un thème explicite (plus de défaut Boilerplate).
    useWorkspaceStore.getState().setBoundary(0, "META");
    expect(useWorkspaceStore.getState().draftClauses).toHaveLength(1);
  });

  it("règle la certitude de la clause sélectionnée", () => {
    const id = useWorkspaceStore.getState().draftClauses[0]!.localId;
    useWorkspaceStore.getState().setCertainty(id, 3);
    expect(useWorkspaceStore.getState().draftClauses[0]!.certainty).toBe(3);
  });

  it("seed depuis une pré-annotation sans écraser les ancres existantes", () => {
    useWorkspaceStore.getState().seedFromPreAnnotation(
      [
        { anchor_index: 0, theme: "X", legal_nature: null, evidence_span: "", rationale: "", certainty: 0 },
        { anchor_index: 7, theme: "TERMINATION", legal_nature: null, evidence_span: "", rationale: "", certainty: 1 },
      ],
      "claude",
    );
    const drafts = useWorkspaceStore.getState().draftClauses;
    // ancre 0 préservée (META, pas écrasée), ancre 7 ajoutée avec provenance.
    expect(drafts.find((c) => c.anchorIndex === 0)?.theme).toBe("META");
    expect(drafts.find((c) => c.anchorIndex === 7)?.seededFrom).toBe("preannotation:claude");
  });

  it("toggle les overlays", () => {
    const before = useWorkspaceStore.getState().showUnfairness;
    useWorkspaceStore.getState().toggleUnfairness();
    expect(useWorkspaceStore.getState().showUnfairness).toBe(!before);
  });

  it("toggle les frontières (défaut ON)", () => {
    expect(useWorkspaceStore.getState().showBoundaries).toBe(true);
    useWorkspaceStore.getState().toggleBoundaries();
    expect(useWorkspaceStore.getState().showBoundaries).toBe(false);
  });

  it("selectRange sélectionne une plage inclusive bornée", () => {
    useWorkspaceStore.getState().selectRange(2, 4);
    expect(useWorkspaceStore.getState().selectedSentences).toEqual([2, 3, 4]);
    // Ordre inversé → même plage triée.
    useWorkspaceStore.getState().selectRange(4, 2);
    expect(useWorkspaceStore.getState().selectedSentences).toEqual([2, 3, 4]);
    // Bornée à nSentences-1 (=9).
    useWorkspaceStore.getState().selectRange(8, 100);
    expect(useWorkspaceStore.getState().selectedSentences).toEqual([8, 9]);
  });

  it("toggleSelected ajoute puis retire un index (trié)", () => {
    useWorkspaceStore.getState().toggleSelected(5);
    useWorkspaceStore.getState().toggleSelected(1);
    expect(useWorkspaceStore.getState().selectedSentences).toEqual([1, 5]);
    useWorkspaceStore.getState().toggleSelected(5);
    expect(useWorkspaceStore.getState().selectedSentences).toEqual([1]);
  });

  it("clearSelection vide la sélection", () => {
    useWorkspaceStore.getState().selectRange(0, 3);
    useWorkspaceStore.getState().clearSelection();
    expect(useWorkspaceStore.getState().selectedSentences).toEqual([]);
  });

  it("setTranslated gère la traduction par phrase", () => {
    useWorkspaceStore.getState().setTranslated(2, true);
    expect(useWorkspaceStore.getState().translatedSentences).toEqual([2]);
    useWorkspaceStore.getState().setTranslated(0, true);
    expect(useWorkspaceStore.getState().translatedSentences).toEqual([0, 2]);
    useWorkspaceStore.getState().setTranslated(2, false);
    expect(useWorkspaceStore.getState().translatedSentences).toEqual([0]);
  });

  it("setDisplayLang règle le mode d'affichage (défaut orig, P10)", () => {
    expect(useWorkspaceStore.getState().displayLang).toBe("orig");
    useWorkspaceStore.getState().setDisplayLang("both");
    expect(useWorkspaceStore.getState().displayLang).toBe("both");
    useWorkspaceStore.getState().setDisplayLang("fr");
    expect(useWorkspaceStore.getState().displayLang).toBe("fr");
    useWorkspaceStore.getState().setDisplayLang("orig");
    expect(useWorkspaceStore.getState().displayLang).toBe("orig");
  });

  it("setSelectedClauses / clearClauseSelection gèrent la sélection de blocs (P8)", () => {
    expect(useWorkspaceStore.getState().selectedClauseIds).toEqual([]);
    useWorkspaceStore.getState().setSelectedClauses(["c1", "c2", "c1"]);
    // Déduplication.
    expect(useWorkspaceStore.getState().selectedClauseIds).toEqual(["c1", "c2"]);
    useWorkspaceStore.getState().clearClauseSelection();
    expect(useWorkspaceStore.getState().selectedClauseIds).toEqual([]);
  });

  it("init et reset réinitialisent displayLang et selectedClauseIds", () => {
    useWorkspaceStore.getState().setDisplayLang("fr");
    useWorkspaceStore.getState().setSelectedClauses(["c1"]);
    useWorkspaceStore.getState().reset();
    expect(useWorkspaceStore.getState().displayLang).toBe("orig");
    expect(useWorkspaceStore.getState().selectedClauseIds).toEqual([]);
  });
});
