import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceStore } from "@/store/workspace";
import { computeRuns, runThemeAt } from "@/lib/runs";
import { getThemeToken } from "@/lib/tokens";
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

  it("setBoundary re-thématise une clause existante (corrige le bug couleur, §6)", () => {
    // anchor 0 existe déjà (META, baseClauses). Choisir un thème via setBoundary
    // — chemin de l'inspecteur « aucune clause » quand la clause n'est pas
    // sélectionnée — DOIT re-thématiser en place, sinon la couleur ne change jamais.
    useWorkspaceStore.getState().setBoundary(0, "TERMINATION");
    const drafts = useWorkspaceStore.getState().draftClauses;
    expect(drafts.filter((c) => c.anchorIndex === 0)).toHaveLength(1); // pas de doublon
    expect(drafts.find((c) => c.anchorIndex === 0)?.theme).toBe("TERMINATION");
    expect(useWorkspaceStore.getState().dirty).toBe(true);
  });

  it("setBoundary sur le même thème reste un no-op (pas de dirty parasite)", () => {
    useWorkspaceStore.getState().setBoundary(0, "META");
    expect(useWorkspaceStore.getState().draftClauses).toHaveLength(1);
    expect(useWorkspaceStore.getState().dirty).toBe(false);
  });

  it("re-thématiser change la couleur dérivée du rail (§6)", () => {
    // La couleur du rail = getThemeToken(runThemeAt(...)).color. Elle DOIT suivre
    // le thème de la clause couvrante après re-thématisation (symptôme rapporté).
    const colorBefore = getThemeToken(
      runThemeAt(computeRuns(useWorkspaceStore.getState().draftClauses, 10), 0),
    ).color;
    useWorkspaceStore.getState().setBoundary(0, "TERMINATION");
    const colorAfter = getThemeToken(
      runThemeAt(computeRuns(useWorkspaceStore.getState().draftClauses, 10), 0),
    ).color;
    expect(colorAfter).not.toBe(colorBefore);
    expect(colorAfter).toBe(getThemeToken("TERMINATION").color);
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

  it("replacePrefill ÉCRASE l'annotation (humaine comprise), dépliée par phrase, annulable", () => {
    // baseClauses : clause humaine @0 META (nSentences = 10).
    const before = useWorkspaceStore
      .getState()
      .draftClauses.map((c) => ({ a: c.anchorIndex, t: c.theme }));

    // Prefill Claude : segments [0..4]=ZZ, [5..9]=X → dépliés PAR PHRASE.
    useWorkspaceStore.getState().replacePrefill([pivot(0, "ZZ"), pivot(5, "X")], "claude");
    const drafts = useWorkspaceStore.getState().draftClauses;
    // @0 est ÉCRASÉ (ZZ seedé Claude) — l'humain META a disparu.
    expect(drafts.find((c) => c.anchorIndex === 0)?.theme).toBe("ZZ");
    expect(drafts.every((c) => c.seededFrom === "preannotation:claude")).toBe(true);
    expect(drafts).toHaveLength(10); // 0..9 dépliés par phrase
    expect(useWorkspaceStore.getState().prefilledJudge).toBe("claude");

    // ANNULABLE : undo restaure l'état humain initial.
    useWorkspaceStore.getState().undo();
    const restored = useWorkspaceStore
      .getState()
      .draftClauses.map((c) => ({ a: c.anchorIndex, t: c.theme }));
    expect(restored).toEqual(before);
  });

  it("replacePrefill(null) retire les clauses seedées et préserve l'humain", () => {
    // Humain @0 (META) + seed Claude @5.
    useWorkspaceStore.getState().setBoundary(5, "X");
    // Marque @5 comme seedé via un prefill puis on en garde l'humain @0.
    useWorkspaceStore.getState().replacePrefill([pivot(5, "X")], "claude"); // écrase tout par seed
    useWorkspaceStore.getState().replacePrefill([], null); // retire le seed
    const drafts = useWorkspaceStore.getState().draftClauses;
    expect(drafts.every((c) => !c.seededFrom?.startsWith("preannotation:"))).toBe(true);
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

// ── Lecture seule stricte (R1) ────────────────────────────────────────────────
describe("workspace store — lecture seule (R1)", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    useWorkspaceStore.getState().init({
      annotationId: "ann-other",
      nSentences: 10,
      clauses: baseClauses,
      readOnly: true,
    });
  });

  it("init pose readOnly ; reset le remet à false", () => {
    expect(useWorkspaceStore.getState().readOnly).toBe(true);
    useWorkspaceStore.getState().reset();
    expect(useWorkspaceStore.getState().readOnly).toBe(false);
  });

  it("setBoundary est neutralisé (pas de création, pas de dirty)", () => {
    useWorkspaceStore.getState().setBoundary(5, "TERMINATION");
    const s = useWorkspaceStore.getState();
    expect(s.draftClauses).toHaveLength(1); // inchangé
    expect(s.draftClauses.find((c) => c.anchorIndex === 5)).toBeUndefined();
    expect(s.dirty).toBe(false);
  });

  it("updateDraft / setCertainty / removeBoundary sont neutralisés", () => {
    const id = useWorkspaceStore.getState().draftClauses[0]!.localId;
    useWorkspaceStore.getState().updateDraft(id, { theme: "TERMINATION" });
    useWorkspaceStore.getState().setCertainty(id, 3);
    useWorkspaceStore.getState().removeBoundary(0);
    const s = useWorkspaceStore.getState();
    expect(s.draftClauses).toHaveLength(1);
    expect(s.draftClauses[0]!.theme).toBe("META");
    expect(s.draftClauses[0]!.certainty ?? null).toBeNull();
    expect(s.dirty).toBe(false);
  });

  it("resolveDivergence / replacePrefill / seedFromPreAnnotation sont neutralisés", () => {
    useWorkspaceStore.getState().resolveDivergence(5, "codex", "TERMINATION");
    useWorkspaceStore.getState().seedFromPreAnnotation(
      [{ anchor_index: 7, theme: "X", legal_nature: null, evidence_span: "", rationale: "", certainty: 0 }],
      "claude",
    );
    const s = useWorkspaceStore.getState();
    expect(s.draftClauses).toHaveLength(1);
    expect(s.dirty).toBe(false);
  });
});

// ── toggleBoundary : annoter / désannoter (C3) ────────────────────────────────
describe("workspace store — toggleBoundary (C3)", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    useWorkspaceStore
      .getState()
      .init({ annotationId: "ann-1", nSentences: 10, clauses: baseClauses });
  });

  it("crée une clause sur une phrase libre", () => {
    useWorkspaceStore.getState().toggleBoundary(5, "TERMINATION");
    const d = useWorkspaceStore.getState().draftClauses.find((c) => c.anchorIndex === 5);
    expect(d?.theme).toBe("TERMINATION");
  });

  it("re-thématise si le thème diffère (pas de doublon)", () => {
    useWorkspaceStore.getState().toggleBoundary(0, "TERMINATION"); // 0 = META au départ
    const at0 = useWorkspaceStore.getState().draftClauses.filter((c) => c.anchorIndex === 0);
    expect(at0).toHaveLength(1);
    expect(at0[0]!.theme).toBe("TERMINATION");
  });

  it("retire la clause si on re-choisit le MÊME thème (désannotation)", () => {
    // 0 = META ; re-choisir META → suppression.
    useWorkspaceStore.getState().toggleBoundary(0, "META");
    expect(
      useWorkspaceStore.getState().draftClauses.find((c) => c.anchorIndex === 0),
    ).toBeUndefined();
  });

  it("est neutralisé en lecture seule", () => {
    useWorkspaceStore.getState().reset();
    useWorkspaceStore
      .getState()
      .init({ annotationId: "ann-x", nSentences: 10, clauses: baseClauses, readOnly: true });
    useWorkspaceStore.getState().toggleBoundary(5, "TERMINATION");
    expect(useWorkspaceStore.getState().draftClauses).toHaveLength(1);
  });
});

// ── applyBlockOp : lots atomiques (L1, Feature B) ─────────────────────────────
describe("workspace store — applyBlockOp (L1)", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    // baseClauses = clause @0 META.
    useWorkspaceStore
      .getState()
      .init({ annotationId: "a1", nSentences: 10, clauses: baseClauses });
  });

  it("annotateRange crée une clause par phrase de la plage", () => {
    useWorkspaceStore
      .getState()
      .applyBlockOp({ kind: "annotateRange", anchors: [2, 3, 4], theme: "TERMINATION" });
    const inRange = useWorkspaceStore
      .getState()
      .draftClauses.filter((c) => [2, 3, 4].includes(c.anchorIndex));
    expect(inRange).toHaveLength(3);
    expect(inRange.every((c) => c.theme === "TERMINATION")).toBe(true);
  });

  it("un lot = UN SEUL snapshot d'undo (annule toute la plage d'un coup)", () => {
    const before = useWorkspaceStore.getState().draftClauses.length; // 1
    useWorkspaceStore
      .getState()
      .applyBlockOp({ kind: "annotateRange", anchors: [2, 3, 4, 5], theme: "TERMINATION" });
    expect(useWorkspaceStore.getState().draftClauses).toHaveLength(before + 4);
    useWorkspaceStore.getState().undo();
    expect(useWorkspaceStore.getState().draftClauses).toHaveLength(before);
  });

  it("journalise UNE seule entrée block.* par lot", () => {
    useWorkspaceStore.getState().clearActionLog();
    useWorkspaceStore
      .getState()
      .applyBlockOp({ kind: "annotateRange", anchors: [2, 3, 4], theme: "META" });
    const log = useWorkspaceStore.getState().actionLog;
    expect(log).toHaveLength(1);
    expect(log[0]!.kind).toBe("block.annotateRange");
  });

  it("clearBlock retire toutes les clauses de la plage (désannotation)", () => {
    useWorkspaceStore
      .getState()
      .applyBlockOp({ kind: "annotateRange", anchors: [2, 3, 4], theme: "META" });
    useWorkspaceStore.getState().applyBlockOp({ kind: "clearBlock", anchors: [2, 3, 4] });
    const d = useWorkspaceStore.getState().draftClauses;
    expect(d.some((c) => [2, 3, 4].includes(c.anchorIndex))).toBe(false);
  });

  it("idempotent : ré-appliquer le même thème ne pousse pas de snapshot", () => {
    useWorkspaceStore
      .getState()
      .applyBlockOp({ kind: "annotateRange", anchors: [2, 3], theme: "META" });
    const undoLen = useWorkspaceStore.getState().undoStack.length;
    useWorkspaceStore
      .getState()
      .applyBlockOp({ kind: "annotateRange", anchors: [2, 3], theme: "META" });
    expect(useWorkspaceStore.getState().undoStack.length).toBe(undoLen);
  });

  it("ignore les ancres hors bornes [0, nSentences)", () => {
    useWorkspaceStore
      .getState()
      .applyBlockOp({ kind: "annotateRange", anchors: [8, 9, 10, 99], theme: "META" });
    const d = useWorkspaceStore.getState().draftClauses;
    expect(d.find((c) => c.anchorIndex === 10)).toBeUndefined();
    expect(d.find((c) => c.anchorIndex === 99)).toBeUndefined();
    expect(d.find((c) => c.anchorIndex === 9)?.theme).toBe("META");
  });

  it("no-op en lecture seule (R1)", () => {
    useWorkspaceStore.getState().reset();
    useWorkspaceStore
      .getState()
      .init({ annotationId: "a2", nSentences: 10, clauses: baseClauses, readOnly: true });
    useWorkspaceStore
      .getState()
      .applyBlockOp({ kind: "annotateRange", anchors: [2, 3], theme: "META" });
    expect(useWorkspaceStore.getState().draftClauses).toHaveLength(1);
  });

  it("équivalence bloc ↔ phrases (B-IAA-1) : même état stocké", () => {
    useWorkspaceStore
      .getState()
      .applyBlockOp({ kind: "annotateRange", anchors: [5, 6, 7], theme: "TERMINATION" });
    const viaBlock = useWorkspaceStore
      .getState()
      .draftClauses.map((c) => ({ a: c.anchorIndex, t: c.theme }))
      .sort((x, y) => x.a - y.a);

    useWorkspaceStore.getState().reset();
    useWorkspaceStore
      .getState()
      .init({ annotationId: "a1", nSentences: 10, clauses: baseClauses });
    useWorkspaceStore.getState().setBoundary(5, "TERMINATION");
    useWorkspaceStore.getState().setBoundary(6, "TERMINATION");
    useWorkspaceStore.getState().setBoundary(7, "TERMINATION");
    const viaSentences = useWorkspaceStore
      .getState()
      .draftClauses.map((c) => ({ a: c.anchorIndex, t: c.theme }))
      .sort((x, y) => x.a - y.a);

    expect(viaBlock).toEqual(viaSentences);
  });
});

describe("applyTriageDecision / applyTriageBatch (acceptation de suggestions)", () => {
  const prim = { label: "TERMINATION", role: "primary" as const, support: 3 };
  const sec = { label: "META", role: "secondary" as const, support: 1 };

  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    useWorkspaceStore
      .getState()
      .init({ annotationId: "ann-1", nSentences: 10, clauses: baseClauses });
  });

  it("crée une clause multi-label VALIDÉE, focalise la phrase et marque dirty", () => {
    useWorkspaceStore.getState().applyTriageDecision({
      anchorIndex: 4, themes: [prim, sec],
      boundary: { type: "soft", support: 2 }, triageLevel: "C3",
    });
    const s = useWorkspaceStore.getState();
    const c = s.draftClauses.find((d) => d.anchorIndex === 4)!;
    expect(c.theme).toBe("TERMINATION"); // miroir du primaire
    expect(c.themes).toHaveLength(2);
    expect(c.boundary).toEqual({ type: "soft", support: 2 });
    expect(c.triageLevel).toBe("C3");
    expect(c.validated).toBe(true);
    expect(s.focusedSentence).toBe(4);
    expect(s.selectedClauseId).toBe(c.localId);
    expect(s.dirty).toBe(true);
  });

  it("upsert : sur une ancre DÉJÀ annotée (seed), met à jour SANS doublon", () => {
    // baseClauses a une clause @0 (id c1, theme META). On accepte une décision @0.
    useWorkspaceStore.getState().applyTriageDecision({
      anchorIndex: 0, themes: [prim, sec], triageLevel: "C2",
    });
    const at0 = useWorkspaceStore.getState().draftClauses.filter((d) => d.anchorIndex === 0);
    expect(at0).toHaveLength(1); // pas de doublon
    expect(at0[0]!.serverId).toBe("c1"); // conserve l'id serveur → autosave fera un PATCH
    expect(at0[0]!.theme).toBe("TERMINATION");
    expect(at0[0]!.themes).toHaveLength(2);
    expect(at0[0]!.validated).toBe(true);
  });

  it("applyTriageBatch applique N décisions en UN snapshot d'undo", () => {
    useWorkspaceStore.getState().applyTriageBatch([
      { anchorIndex: 2, themes: [prim], triageLevel: "C1" },
      { anchorIndex: 3, themes: [prim], triageLevel: "C1" },
    ]);
    const s = useWorkspaceStore.getState();
    expect(s.draftClauses.filter((d) => d.validated && d.triageLevel === "C1")).toHaveLength(2);
    // un seul undo défait tout le lot.
    useWorkspaceStore.getState().undo();
    expect(useWorkspaceStore.getState().draftClauses.some((d) => d.anchorIndex === 2)).toBe(false);
    expect(useWorkspaceStore.getState().draftClauses.some((d) => d.anchorIndex === 3)).toBe(false);
  });

  it("readOnly : applyTriageDecision est un no-op", () => {
    useWorkspaceStore.getState().reset();
    useWorkspaceStore.getState().init({ annotationId: "ann-1", nSentences: 10, clauses: [], readOnly: true });
    useWorkspaceStore.getState().applyTriageDecision({ anchorIndex: 1, themes: [prim] });
    expect(useWorkspaceStore.getState().draftClauses).toHaveLength(0);
  });
});
