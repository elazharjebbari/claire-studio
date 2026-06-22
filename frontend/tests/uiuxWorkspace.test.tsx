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
