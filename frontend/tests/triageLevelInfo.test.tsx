import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TriageLevelInfo, TriageLevelBadge } from "@/components/workspace/triage/TriageLevelInfo";

describe("TriageLevelBadge — pastille de niveau partagée (AA)", () => {
  it("rend code · libellé + icône, testId paramétrable", () => {
    render(<TriageLevelBadge level="C5" testId="b" />);
    const badge = screen.getByTestId("b");
    expect(badge).toHaveTextContent("C5");
    expect(badge.querySelector("svg")).toBeTruthy();
    // Fond plein + couleur de texte explicite (readableTextColor) → AA par construction.
    expect(badge.style.backgroundColor).not.toBe("");
    expect(badge.style.color).not.toBe("");
  });
});

describe("TriageLevelInfo — révélation à la demande du barème C1→C5", () => {
  it("replié par défaut : aucune pollution permanente (panneau absent)", () => {
    render(<TriageLevelInfo current="C4" />);
    expect(screen.getByTestId("triage-level-info-toggle")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("triage-level-info-panel")).toBeNull();
  });

  it("au clic : dévoile les 5 niveaux, le niveau courant mis en avant", () => {
    render(<TriageLevelInfo current="C4" />);
    fireEvent.click(screen.getByTestId("triage-level-info-toggle"));
    expect(screen.getByTestId("triage-level-info-panel")).toBeInTheDocument();
    for (const lvl of ["C1", "C2", "C3", "C4", "C5"]) {
      expect(screen.getByTestId(`triage-level-row-${lvl}`)).toBeInTheDocument();
    }
    // Seul le niveau courant est marqué « current ».
    expect(screen.getByTestId("triage-level-row-C4")).toHaveAttribute("data-current", "true");
    expect(screen.getByTestId("triage-level-row-C1")).not.toHaveAttribute("data-current");
  });

  it("Échap referme le panneau (popover non modal)", () => {
    render(<TriageLevelInfo current="C1" />);
    fireEvent.click(screen.getByTestId("triage-level-info-toggle"));
    expect(screen.getByTestId("triage-level-info-panel")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("triage-level-info-panel")).toBeNull();
  });
});
