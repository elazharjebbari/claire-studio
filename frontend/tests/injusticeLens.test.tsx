import { describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach } from "vitest";
import { InjusticeLens } from "@/components/workspace/InjusticeLens";
import type { UnfairnessMark } from "@/components/workspace/useUnfairness";

afterEach(cleanup);

const LTD: UnfairnessMark = {
  category: "LTD", level: 3, label: "Limitation de responsabilité", color: "#DC2626",
  intensity: 0.9, sense: "Clause qui limite ou exclut la responsabilité du fournisseur.",
  relatedThemes: ["LIMITATION_LIABILITY", "WARRANTY_DISCLAIMER"],
};
const A: UnfairnessMark = {
  category: "A", level: 2, label: "Arbitrage", color: "#EC4899", intensity: 0.55,
  sense: "Clause qui impose l'arbitrage (renonce au tribunal).", relatedThemes: ["ARBITRATION_DISPUTES"],
};
const SENTENCE = "Provider shall not be liable; disputes go to binding arbitration.";

describe("InjusticeLens — aperçu hoverable (preview)", () => {
  it("affiche la sévérité max + le corps complet (cartes + évidence)", () => {
    render(<InjusticeLens mode="preview" x={10} y={10} marks={[LTD, A]} sentenceText={SENTENCE} />);
    const preview = screen.getByTestId("injustice-lens-preview");
    expect(preview).toBeInTheDocument();
    // sévérité max = N3 (LTD en tête)
    const badge = screen.getAllByTestId("severity-badge")[0];
    expect(badge).toHaveAttribute("data-tone", "high");
    expect(badge).toHaveTextContent("N3");
    expect(screen.getByText(/2 catégories/)).toBeInTheDocument();
    // corps complet (carte par catégorie + évidence) — la carte est riche dès le survol.
    expect(screen.getByTestId("injustice-card-LTD")).toBeInTheDocument();
    expect(screen.getByTestId("injustice-card-A")).toBeInTheDocument();
    expect(screen.getByTestId("injustice-evidence")).toBeInTheDocument();
  });

  it("est survolable (handlers de maintien)", () => {
    const onEnter = vi.fn();
    render(<InjusticeLens mode="preview" x={0} y={0} marks={[A]} sentenceText={SENTENCE} onMouseEnter={onEnter} />);
    fireEvent.mouseEnter(screen.getByTestId("injustice-lens-preview"));
    expect(onEnter).toHaveBeenCalled();
  });
});

describe("InjusticeLens — fiche (pinned)", () => {
  it("liste une carte par catégorie (triée), sens + thèmes + évidence + rappel", () => {
    render(<InjusticeLens mode="pinned" x={10} y={10} marks={[LTD, A]} sentenceText={SENTENCE} onClose={() => {}} />);
    expect(screen.getByTestId("injustice-lens-pinned")).toHaveAttribute("role", "dialog");
    // une carte par catégorie
    expect(screen.getByTestId("injustice-card-LTD")).toBeInTheDocument();
    expect(screen.getByTestId("injustice-card-A")).toBeInTheDocument();
    // sens + libellé
    expect(screen.getByText(/limite ou exclut la responsabilité/i)).toBeInTheDocument();
    // thème associé (libellé du token de thème)
    expect(screen.getByTestId("injustice-card-LTD")).toHaveTextContent(/Limitation de responsabilité|Exclusion/i);
    // évidence : phrase + repère indicatif surligné
    const evidence = screen.getByTestId("injustice-evidence");
    expect(evidence).toHaveTextContent(/shall not be liable/i);
    expect(screen.getAllByTestId("evidence-hint").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/indicatif/i).length).toBeGreaterThan(0);
    // rappel pédagogique
    expect(screen.getByText(/distincte de votre/i)).toBeInTheDocument();
  });

  it("Échap et bouton ferment la fiche", () => {
    const onClose = vi.fn();
    render(<InjusticeLens mode="pinned" x={10} y={10} marks={[LTD]} sentenceText={SENTENCE} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("injustice-lens-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("une seule catégorie → une seule carte", () => {
    render(<InjusticeLens mode="pinned" x={0} y={0} marks={[A]} sentenceText={SENTENCE} onClose={() => {}} />);
    expect(screen.getByTestId("injustice-card-A")).toBeInTheDocument();
    expect(screen.queryByTestId("injustice-card-LTD")).toBeNull();
  });
});
