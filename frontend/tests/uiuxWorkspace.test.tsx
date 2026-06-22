/**
 * Refonte workspace (axes 1/2/7) : briques pures + composants.
 * - agreementNway : accord N-modèles (axe 7).
 * - NaturePicker : sélecteur de nature juridique (axe 2).
 * - RationaleHover : aperçu passif au survol (axe 1).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { agreementNway } from "@/lib/llmAgreement";
import { NaturePicker } from "@/components/ui/NaturePicker";
import { RationaleHover } from "@/components/workspace/RationaleHover";
import { SelectionTools } from "@/components/workspace/SelectionTools";
import { DocumentMinimap } from "@/components/workspace/DocumentMinimap";
import { BoundaryEvidence } from "@/components/workspace/BoundaryEvidence";
import { useWorkspaceStore } from "@/store/workspace";
import type { LegalNature } from "@/types/contract";

afterEach(() => cleanup());

describe("agreementNway (axe 7 — accord N-modèles)", () => {
  it("100% quand tous les juges présents s'accordent partout", () => {
    const r = agreementNway([["A", "A", "B"], ["A", "A", "B"], ["A", "A", "B"]], 3);
    expect(r.judges).toBe(3);
    expect(r.support).toBe(3);
    expect(Math.round(r.fullAgreementPct)).toBe(100);
  });
  it("accord partiel : seules les phrases où TOUS s'accordent comptent", () => {
    // phrase 0: A/A/A (accord) ; phrase 1: A/B/A (désaccord) ; phrase 2: C/C/C (accord)
    const r = agreementNway([["A", "A", "C"], ["A", "B", "C"], ["A", "A", "C"]], 3);
    expect(r.support).toBe(3);
    expect(Math.round(r.fullAgreementPct)).toBe(67);
  });
  it("ignore les phrases couvertes par aucun juge (support = union)", () => {
    const r = agreementNway([[null, "A", null], [null, "A", null]], 3);
    expect(r.support).toBe(1);
    expect(r.fullAgreementPct).toBe(100);
  });
  it("dégradé : 0 juge → 0", () => {
    expect(agreementNway([], 5)).toEqual({ fullAgreementPct: 0, support: 0, judges: 0 });
  });
});

const NATURES: LegalNature[] = [
  { id: "1", schemeId: "s", code: "OBLIGATION", label: "Obligation", definition: "Doit faire", order: 0 },
  { id: "2", schemeId: "s", code: "PROHIBITION", label: "Interdiction", order: 1 },
];

describe("NaturePicker (axe 2)", () => {
  it("rend toutes les natures + l'option « aucune »", () => {
    render(<NaturePicker value={null} legalNatures={NATURES} onChange={() => {}} />);
    expect(screen.getByTestId("nature-option-none")).toBeInTheDocument();
    expect(screen.getByTestId("nature-option-OBLIGATION")).toBeInTheDocument();
    expect(screen.getByTestId("nature-option-PROHIBITION")).toBeInTheDocument();
  });
  it("sélectionner une nature appelle onChange(code)", () => {
    const onChange = vi.fn();
    render(<NaturePicker value={null} legalNatures={NATURES} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("nature-option-OBLIGATION"));
    expect(onChange).toHaveBeenCalledWith("OBLIGATION");
  });
  it("re-cliquer la nature sélectionnée l'efface (onChange(null))", () => {
    const onChange = vi.fn();
    render(<NaturePicker value="OBLIGATION" legalNatures={NATURES} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("nature-option-OBLIGATION"));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("RationaleHover (axe 1)", () => {
  it("affiche le rationale humain + la proposition LLM", () => {
    render(
      <RationaleHover
        x={10}
        y={10}
        humanTheme="TERMINATION"
        humanRationale="Clause de résiliation unilatérale"
        humanEvidence="may terminate at any time"
        judges={[{ label: "Mistral", theme: "TERMINATION", rationale: "Fin de contrat", evidence: null }]}
      />,
    );
    const pop = screen.getByTestId("rationale-hover");
    expect(pop).toHaveTextContent("Clause de résiliation unilatérale");
    expect(pop).toHaveTextContent("Mistral");
  });
  it("ne rend RIEN si aucune matière (pas de rationale humain ni de LLM)", () => {
    const { container } = render(
      <RationaleHover x={0} y={0} humanTheme={null} humanRationale={null} humanEvidence={null} judges={[]} />,
    );
    expect(container.querySelector('[data-testid="rationale-hover"]')).toBeNull();
  });
});

describe("store.setSelection (axe 4 — sélection arbitraire)", () => {
  it("déduplique, trie et borne à [0, nSentences)", () => {
    const st = useWorkspaceStore.getState();
    st.reset();
    st.init({ annotationId: "a", nSentences: 5, clauses: [] });
    useWorkspaceStore.getState().setSelection([3, 1, 1, 9, -2, 4]);
    expect(useWorkspaceStore.getState().selectedSentences).toEqual([1, 3, 4]);
  });
});

describe("SelectionTools (axe 4)", () => {
  const cbs = {
    onToBoundary: () => {},
    onCurrentSegment: () => {},
    onWholeTheme: () => {},
    onAll: () => {},
    onClear: () => {},
  };
  it("rend les actions de sélection ; compteur/effacer cachés si rien de sélectionné", () => {
    render(<SelectionTools selectedCount={0} {...cbs} />);
    expect(screen.getByTestId("select-to-boundary")).toBeInTheDocument();
    expect(screen.getByTestId("select-segment")).toBeInTheDocument();
    expect(screen.getByTestId("select-theme")).toBeInTheDocument();
    expect(screen.getByTestId("select-all")).toBeInTheDocument();
    expect(screen.queryByTestId("selection-count")).toBeNull();
    expect(screen.queryByTestId("selection-clear")).toBeNull();
  });
  it("affiche le compteur + effacer quand des phrases sont sélectionnées", () => {
    const onClear = vi.fn();
    render(<SelectionTools selectedCount={7} {...cbs} onClear={onClear} />);
    expect(screen.getByTestId("selection-count")).toHaveTextContent("7");
    fireEvent.click(screen.getByTestId("selection-clear"));
    expect(onClear).toHaveBeenCalled();
  });
  it("clic sur « Segment » appelle le bon callback", () => {
    const onCurrentSegment = vi.fn();
    render(<SelectionTools selectedCount={0} {...cbs} onCurrentSegment={onCurrentSegment} />);
    fireEvent.click(screen.getByTestId("select-segment"));
    expect(onCurrentSegment).toHaveBeenCalled();
  });
});

describe("DocumentMinimap (axe 5)", () => {
  const colors = ["#06B6D4", undefined, "#F59E0B", "#A78BFA"];
  it("affiche l'indicateur de viewport quand ça défile", () => {
    render(
      <DocumentMinimap
        sentenceColors={colors}
        scrollPct={0.5}
        viewportPct={0.3}
        hasScroll
        focused={2}
        onJumpFraction={() => {}}
      />,
    );
    expect(screen.getByTestId("document-minimap")).toBeInTheDocument();
    expect(screen.getByTestId("minimap-viewport")).toBeInTheDocument();
  });
  it("dégrade sans indicateur de viewport si rien ne défile", () => {
    render(
      <DocumentMinimap
        sentenceColors={colors}
        scrollPct={0}
        viewportPct={1}
        hasScroll={false}
        focused={0}
        onJumpFraction={() => {}}
      />,
    );
    expect(screen.queryByTestId("minimap-viewport")).toBeNull();
  });
  it("clic sur le rail saute à une fraction du document", () => {
    const onJumpFraction = vi.fn();
    render(
      <DocumentMinimap
        sentenceColors={colors}
        scrollPct={0}
        viewportPct={1}
        hasScroll={false}
        focused={0}
        onJumpFraction={onJumpFraction}
      />,
    );
    fireEvent.click(screen.getByTestId("document-minimap").firstChild as Element);
    expect(onJumpFraction).toHaveBeenCalled();
  });
});

describe("BoundaryEvidence N-way (œil de frontière, Mistral inclus)", () => {
  const det = (theme: string, nature: string | null) => ({
    anchorIndex: 4,
    endIndex: 6,
    theme,
    rationale: `rationale ${theme}`,
    evidence: "evidence",
    legalNature: nature,
  });
  it("rend un onglet par juge présent + Comparer + la nature LLM", () => {
    const judges = [
      { id: "claude", label: "Claude", detail: det("TERMINATION", "OBLIGATION") },
      { id: "mistral", label: "Mistral", detail: det("ACCEPTABLE_USE", "PROHIBITION") },
      { id: "codex", label: "Codex", detail: null },
    ];
    render(<BoundaryEvidence x={10} y={10} judges={judges} onClose={() => {}} />);
    expect(screen.getByTestId("boundary-tab-claude")).toBeInTheDocument();
    expect(screen.getByTestId("boundary-tab-mistral")).toBeInTheDocument();
    expect(screen.getByTestId("boundary-tab-compare")).toBeInTheDocument();
    // Codex sans proposition → pas d'onglet.
    expect(screen.queryByTestId("boundary-tab-codex")).toBeNull();
    // Nature LLM visible sur la carte du juge actif (claude).
    expect(screen.getByTestId("boundary-card-claude")).toHaveTextContent("OBLIGATION");
  });
  it("adopter Mistral appelle resolveDivergenceRange sur tout le segment", () => {
    useWorkspaceStore.getState().reset();
    useWorkspaceStore.getState().init({ annotationId: "a", nSentences: 10, clauses: [] });
    const judges = [
      { id: "claude", label: "Claude", detail: det("TERMINATION", null) },
      { id: "mistral", label: "Mistral", detail: det("ACCEPTABLE_USE", "PROHIBITION") },
    ];
    render(<BoundaryEvidence x={0} y={0} judges={judges} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId("boundary-tab-mistral"));
    fireEvent.click(screen.getByTestId("boundary-adopt-mistral"));
    const d = useWorkspaceStore.getState().draftClauses;
    // Segment 4..6 adopté depuis Mistral → 3 clauses resolvedFrom=mistral.
    const adopted = d.filter((c) => c.resolvedFrom === "mistral");
    expect(adopted.length).toBe(3);
    expect(adopted.every((c) => c.theme === "ACCEPTABLE_USE")).toBe(true);
  });
});
