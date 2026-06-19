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

  it("pilote la source et la version LLM, réinitialisées au reset (multi-versions)", () => {
    expect(useWorkspaceStore.getState().llmSource).toBe("human");
    expect(useWorkspaceStore.getState().llmVersion).toBeNull();
    useWorkspaceStore.getState().setLlmSource("compare");
    useWorkspaceStore.getState().setLlmVersion("v9.2");
    expect(useWorkspaceStore.getState().llmSource).toBe("compare");
    expect(useWorkspaceStore.getState().llmVersion).toBe("v9.2");
    // null = auto (version la plus riche, tolérante aux champs en plus/en moins).
    useWorkspaceStore.getState().setLlmVersion(null);
    expect(useWorkspaceStore.getState().llmVersion).toBeNull();
    useWorkspaceStore.getState().reset();
    expect(useWorkspaceStore.getState().llmSource).toBe("human");
    expect(useWorkspaceStore.getState().llmVersion).toBeNull();
  });

  it("resolveDivergence crée une clause arbitrée avec voyant (resolvedFrom)", () => {
    // Ancre 5 vide → adoption de Codex y crée une clause marquée resolvedFrom.
    useWorkspaceStore.getState().resolveDivergence(5, "codex", "TERMINATION");
    const d = useWorkspaceStore.getState().draftClauses.find((c) => c.anchorIndex === 5);
    expect(d?.theme).toBe("TERMINATION");
    expect(d?.resolvedFrom).toBe("codex");
    expect(useWorkspaceStore.getState().dirty).toBe(true);
  });

  it("resolveDivergence met à jour une clause existante et bascule le juge", () => {
    // Ancre 0 existe déjà (META, baseClauses) → adoption Claude la met à jour en place.
    useWorkspaceStore.getState().resolveDivergence(0, "claude", "PREAMBLE_SCOPE");
    const drafts = useWorkspaceStore.getState().draftClauses;
    expect(drafts.filter((c) => c.anchorIndex === 0)).toHaveLength(1); // pas de doublon
    const d = drafts.find((c) => c.anchorIndex === 0);
    expect(d?.theme).toBe("PREAMBLE_SCOPE");
    expect(d?.resolvedFrom).toBe("claude");
  });

  it("toggleComparePanel bascule l'état du panneau comparatif (défaut OFF)", () => {
    expect(useWorkspaceStore.getState().showComparePanel).toBe(false);
    useWorkspaceStore.getState().toggleComparePanel();
    expect(useWorkspaceStore.getState().showComparePanel).toBe(true);
    useWorkspaceStore.getState().reset();
    expect(useWorkspaceStore.getState().showComparePanel).toBe(false);
  });

  it("changer de version LLM ne modifie PAS les clauses humaines (non destructif)", () => {
    const before = useWorkspaceStore.getState().draftClauses;
    useWorkspaceStore.getState().setLlmVersion("v9.2");
    useWorkspaceStore.getState().setLlmSource("compare");
    // llmVersion/llmSource sont des champs d'AFFICHAGE : les drafts restent identiques.
    expect(useWorkspaceStore.getState().draftClauses).toBe(before);
    expect(useWorkspaceStore.getState().llmVersion).toBe("v9.2");
  });

  const pivot = (anchor_index: number, theme: string) => ({
    anchor_index,
    theme,
    legal_nature: null,
    evidence_span: "",
    rationale: "",
    certainty: 0 as const,
  });

  it("replacePrefill bascule de juge sans écraser l'annotation humaine (point 0a)", () => {
    // anchor 0 = clause humaine (baseClauses, seededFrom null).
    useWorkspaceStore.getState().replacePrefill([pivot(5, "X"), pivot(0, "ZZ")], "claude");
    let drafts = useWorkspaceStore.getState().draftClauses;
    // anchor 0 humain préservé (pas écrasé par le seed), anchor 5 seedé Claude.
    expect(drafts.find((c) => c.anchorIndex === 0)?.theme).toBe("META");
    expect(drafts.find((c) => c.anchorIndex === 5)?.seededFrom).toBe("preannotation:claude");
    expect(useWorkspaceStore.getState().prefilledJudge).toBe("claude");

    // Bascule vers Codex : le seed Claude @5 disparaît, le seed Codex @7 apparaît.
    useWorkspaceStore.getState().replacePrefill([pivot(7, "Y")], "codex");
    drafts = useWorkspaceStore.getState().draftClauses;
    expect(drafts.find((c) => c.anchorIndex === 5)).toBeUndefined();
    expect(drafts.find((c) => c.anchorIndex === 7)?.seededFrom).toBe("preannotation:codex");
    expect(drafts.find((c) => c.anchorIndex === 0)?.theme).toBe("META"); // humain intact
    expect(useWorkspaceStore.getState().prefilledJudge).toBe("codex");

    // Effacer le pré-remplissage : ne reste que l'humain.
    useWorkspaceStore.getState().replacePrefill([], null);
    drafts = useWorkspaceStore.getState().draftClauses;
    expect(drafts.every((c) => !c.seededFrom?.startsWith("preannotation:"))).toBe(true);
    expect(drafts.find((c) => c.anchorIndex === 0)?.theme).toBe("META");
    expect(useWorkspaceStore.getState().prefilledJudge).toBeNull();
  });

  it("journalise les actions et clearActionLog vide le journal (point 2)", () => {
    expect(useWorkspaceStore.getState().actionLog).toHaveLength(0);
    useWorkspaceStore.getState().setBoundary(5, "TERMINATION");
    const id = useWorkspaceStore.getState().draftClauses.find((c) => c.anchorIndex === 5)!.localId;
    useWorkspaceStore.getState().setCertainty(id, 3);
    const log = useWorkspaceStore.getState().actionLog;
    expect(log.length).toBe(2);
    expect(log[0]!.kind).toBe("clause.create");
    expect(log[1]!.kind).toBe("clause.set_certainty");
    expect(log[0]!.anchorIndex).toBe(5);
    useWorkspaceStore.getState().clearActionLog();
    expect(useWorkspaceStore.getState().actionLog).toHaveLength(0);
  });

  it("undo/redo restaure puis rétablit l'état des clauses (point 4a)", () => {
    const before = useWorkspaceStore.getState().draftClauses.length; // 1 (baseClauses)
    useWorkspaceStore.getState().setBoundary(5, "TERMINATION");
    expect(useWorkspaceStore.getState().draftClauses).toHaveLength(before + 1);

    // Annuler → revient à l'état d'avant la création.
    useWorkspaceStore.getState().undo();
    expect(useWorkspaceStore.getState().draftClauses).toHaveLength(before);
    expect(useWorkspaceStore.getState().draftClauses.find((c) => c.anchorIndex === 5)).toBeUndefined();

    // Rétablir → la clause revient.
    useWorkspaceStore.getState().redo();
    expect(useWorkspaceStore.getState().draftClauses).toHaveLength(before + 1);
    expect(useWorkspaceStore.getState().draftClauses.find((c) => c.anchorIndex === 5)?.theme).toBe(
      "TERMINATION",
    );
  });

  it("une nouvelle mutation purge la pile de rétablissement (point 4a)", () => {
    useWorkspaceStore.getState().setBoundary(5, "TERMINATION");
    useWorkspaceStore.getState().undo();
    expect(useWorkspaceStore.getState().redoStack.length).toBe(1);
    // Une nouvelle action efface le futur (impossible de rétablir l'ancienne branche).
    useWorkspaceStore.getState().setBoundary(6, "META");
    expect(useWorkspaceStore.getState().redoStack.length).toBe(0);
  });

  it("toggleAttribution bascule l'overlay d'attribution (défaut OFF, point 3)", () => {
    expect(useWorkspaceStore.getState().showAttribution).toBe(false);
    useWorkspaceStore.getState().toggleAttribution();
    expect(useWorkspaceStore.getState().showAttribution).toBe(true);
    useWorkspaceStore.getState().reset();
    expect(useWorkspaceStore.getState().showAttribution).toBe(false);
  });

  it("undo/redo sont des no-op quand les piles sont vides", () => {
    const snap = useWorkspaceStore.getState().draftClauses;
    useWorkspaceStore.getState().undo();
    expect(useWorkspaceStore.getState().draftClauses).toBe(snap);
    useWorkspaceStore.getState().redo();
    expect(useWorkspaceStore.getState().draftClauses).toBe(snap);
  });

  it("init et reset réinitialisent displayLang et selectedClauseIds", () => {
    useWorkspaceStore.getState().setDisplayLang("fr");
    useWorkspaceStore.getState().setSelectedClauses(["c1"]);
    useWorkspaceStore.getState().reset();
    expect(useWorkspaceStore.getState().displayLang).toBe("orig");
    expect(useWorkspaceStore.getState().selectedClauseIds).toEqual([]);
  });
});
