/**
 * Inspecteur d'arbitrage GOLD — les trois impossibilités levées (lot 4 du dossier
 * docs/pactiva/dossier-gold-execution) :
 *  1. décider un thème HORS des votes des annotateurs (les trois peuvent se tromper) ;
 *  2. décider les SECONDAIRES (le corpus est multi-étiquettes ; la politique de campagne
 *     `advisory` ne les promeut jamais d'office) ;
 *  3. décider une phrase que PERSONNE n'a couverte (sinon la finalisation est inatteignable).
 * Plus : signalement d'égalité et ordre STABLE des candidats (raccourcis 1..9).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { GoldInspectorPanel, candidatePrimaries } from "@/components/gold/GoldInspectorPanel";
import type { GoldSentenceRow } from "@/lib/gold/types";

afterEach(() => cleanup());

function row(over: Partial<GoldSentenceRow> = {}): GoldSentenceRow {
  return {
    index: 7,
    text: "The provider may terminate your account at any time.",
    annotators: [
      { voterId: "a1", userId: 1, displayName: "Alice", color: "#8B5CF6", primary: "TERMINATION", secondaries: [] },
      { voterId: "a2", userId: 2, displayName: "Bob", color: "#0EA5E9", primary: "LIMITATION_LIABILITY", secondaries: [] },
      { voterId: "a3", userId: 3, displayName: "Carol", color: "#22C55E", primary: "ACCEPTABLE_USE", secondaries: [] },
    ],
    llms: [],
    agreementClass: "divergence",
    riskBand: "high",
    autoLevel: "manual",
    confidence: 0.33,
    humanDissent: false,
    proposedPrimary: "ACCEPTABLE_USE", // vainqueur ALPHABÉTIQUE, pas un consensus
    proposedSecondaries: [],
    tie: true,
    nCovering: 3,
    decided: false,
    autoResolved: false,
    primary: "",
    secondaries: [],
    decidedBy: null,
    decidedByName: "",
    comment: "",
    ...over,
  } as GoldSentenceRow;
}

describe("candidatePrimaries", () => {
  it("⭐ ordre STABLE (alphabétique) — la touche « 1 » ne doit pas changer de sens d'une phrase à l'autre", () => {
    const a = candidatePrimaries(row());
    const b = candidatePrimaries(
      row({
        // mêmes thèmes, ordre de votes inversé
        annotators: [...row().annotators].reverse(),
      }),
    );
    expect(a).toEqual(b);
    expect(a).toEqual(["ACCEPTABLE_USE", "LIMITATION_LIABILITY", "TERMINATION"]);
  });
});

describe("GoldInspectorPanel", () => {
  it("⭐ signale l'ÉGALITÉ : la proposition n'est qu'un départage alphabétique", () => {
    render(<GoldInspectorPanel sentence={row()} canDecide pending={false} onDecide={vi.fn()} />);
    expect(screen.getByTestId("gold-tie-warning").textContent).toMatch(/départage alphabétique/);
  });

  it("adopte un candidat voté (voie rapide) avec ses secondaires proposés", () => {
    const onDecide = vi.fn();
    render(<GoldInspectorPanel sentence={row()} canDecide pending={false} onDecide={onDecide} />);
    fireEvent.click(screen.getByTestId("gold-decide-TERMINATION"));
    expect(onDecide).toHaveBeenCalledWith(7, "TERMINATION", [], expect.any(Number));
  });

  it("⭐ permet de décider un thème HORS des votes (les trois annotateurs peuvent se tromper)", () => {
    const onDecide = vi.fn();
    render(<GoldInspectorPanel sentence={row()} canDecide pending={false} onDecide={onDecide} />);
    // Le composeur est ouvert d'office sur une égalité.
    const composer = screen.getByTestId("gold-decision-composer");
    expect(composer).toBeInTheDocument();
    // PRIVACY_DATA n'est proposé par AUCUN annotateur.
    expect(screen.queryByTestId("gold-decide-PRIVACY_DATA")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("theme-option-PRIVACY_DATA"));
    fireEvent.click(screen.getByTestId("gold-decision-submit"));
    expect(onDecide).toHaveBeenCalledWith(7, "PRIVACY_DATA", [], 0, "");
  });

  it("⭐ permet de décider les SECONDAIRES (multi-label réellement arbitrable)", () => {
    const onDecide = vi.fn();
    render(<GoldInspectorPanel sentence={row()} canDecide pending={false} onDecide={onDecide} />);
    fireEvent.click(screen.getByTestId("theme-option-TERMINATION")); // devient primaire
    fireEvent.click(screen.getByTestId("theme-option-FEES_PAYMENT")); // devient secondaire
    fireEvent.click(screen.getByTestId("gold-decision-submit"));
    expect(onDecide).toHaveBeenCalledWith(7, "TERMINATION", ["FEES_PAYMENT"], 0, "");
  });

  it("⭐ transmet la JUSTIFICATION de l'arbitrage", () => {
    const onDecide = vi.fn();
    render(<GoldInspectorPanel sentence={row()} canDecide pending={false} onDecide={onDecide} />);
    fireEvent.click(screen.getByTestId("theme-option-TERMINATION"));
    fireEvent.click(screen.getByTestId("gold-comment-open"));
    fireEvent.change(screen.getByTestId("gold-comment"), {
      target: { value: "Clause de résiliation unilatérale." },
    });
    fireEvent.click(screen.getByTestId("gold-decision-submit"));
    expect(onDecide).toHaveBeenCalledWith(
      7, "TERMINATION", [], 0, "Clause de résiliation unilatérale.",
    );
  });

  it("⭐ une phrase NON COUVERTE reste décidable (sinon la finalisation est impossible)", () => {
    const onDecide = vi.fn();
    const uncovered = row({
      annotators: [], agreementClass: "empty", proposedPrimary: "", tie: false, nCovering: 0,
    });
    render(<GoldInspectorPanel sentence={uncovered} canDecide pending={false} onDecide={onDecide} />);
    expect(screen.getByTestId("gold-uncovered")).toBeInTheDocument();
    // Aucun candidat, mais le composeur est ouvert d'office : la décision reste possible.
    fireEvent.click(screen.getByTestId("theme-option-META"));
    fireEvent.click(screen.getByTestId("gold-decision-submit"));
    expect(onDecide).toHaveBeenCalledWith(7, "META", [], 0, "");
  });

  it("signale une couverture SOLITAIRE (aucun accord constatable)", () => {
    const solitary = row({
      annotators: [row().annotators[0]!], agreementClass: "strict", autoLevel: "auto_1click",
      tie: false, nCovering: 1, proposedPrimary: "TERMINATION",
    });
    render(<GoldInspectorPanel sentence={solitary} canDecide pending={false} onDecide={vi.fn()} />);
    expect(screen.getByTestId("gold-solitary")).toBeInTheDocument();
  });

  it("verrou non détenu → lecture seule, aucun contrôle de décision", () => {
    render(<GoldInspectorPanel sentence={row()} canDecide={false} pending={false} onDecide={vi.fn()} />);
    expect(screen.getByTestId("gold-inspector-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("gold-decision-composer")).not.toBeInTheDocument();
  });
});
