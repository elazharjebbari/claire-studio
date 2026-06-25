import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ThemeMultiPicker } from "@/components/ui/ThemeMultiPicker";
import type { ThemeTag } from "@/types/contract";

afterEach(cleanup);

const CODES = ["LIMITATION_LIABILITY", "ARBITRATION_DISPUTES", "PREAMBLE_SCOPE", "TERMINATION"];
const REFUGES = ["PREAMBLE_SCOPE", "MISC_BOILERPLATE"];

function setup(selection: ThemeTag[], extra: Partial<React.ComponentProps<typeof ThemeMultiPicker>> = {}) {
  const onToggle = vi.fn();
  const onPromote = vi.fn();
  render(
    <ThemeMultiPicker
      selection={selection}
      themeCodes={CODES}
      refuges={REFUGES}
      onToggle={onToggle}
      onPromote={onPromote}
      {...extra}
    />,
  );
  return { onToggle, onPromote };
}

describe("ThemeMultiPicker — grille unifiée primaire + secondaires", () => {
  it("sélection vide → invite + clic appelle onToggle", () => {
    const { onToggle } = setup([]);
    expect(screen.getByTestId("multipicker-summary")).toHaveTextContent(/principal/i);
    fireEvent.click(screen.getByTestId("theme-option-LIMITATION_LIABILITY"));
    expect(onToggle).toHaveBeenCalledWith("LIMITATION_LIABILITY");
  });

  it("primaire ★ + secondaires numérotés (ordre 1, 2)", () => {
    setup([
      { label: "LIMITATION_LIABILITY", role: "primary" },
      { label: "ARBITRATION_DISPUTES", role: "secondary" },
      { label: "TERMINATION", role: "secondary" },
    ]);
    // primaire : badge ★ Principal + data-role
    expect(screen.getByTestId("primary-badge-LIMITATION_LIABILITY")).toBeInTheDocument();
    expect(screen.getByTestId("theme-option-LIMITATION_LIABILITY")).toHaveAttribute("data-role", "primary");
    // secondaires : ordre 1 puis 2
    expect(screen.getByTestId("secondary-order-ARBITRATION_DISPUTES")).toHaveTextContent("1");
    expect(screen.getByTestId("secondary-order-TERMINATION")).toHaveTextContent("2");
    // résumé
    expect(screen.getByTestId("multipicker-summary")).toHaveTextContent(/1 principal.*2 secondaires/);
  });

  it("★ promeut un secondaire en primaire", () => {
    const { onPromote } = setup([
      { label: "LIMITATION_LIABILITY", role: "primary" },
      { label: "ARBITRATION_DISPUTES", role: "secondary" },
    ]);
    fireEvent.click(screen.getByTestId("promote-ARBITRATION_DISPUTES"));
    expect(onPromote).toHaveBeenCalledWith("ARBITRATION_DISPUTES");
  });

  it("re-clic d'une option sélectionnée appelle onToggle (retrait)", () => {
    const { onToggle } = setup([
      { label: "LIMITATION_LIABILITY", role: "primary" },
      { label: "ARBITRATION_DISPUTES", role: "secondary" },
    ]);
    fireEvent.click(screen.getByTestId("theme-option-ARBITRATION_DISPUTES"));
    expect(onToggle).toHaveBeenCalledWith("ARBITRATION_DISPUTES");
  });

  it("✕ « retirer » présent sur les thèmes SÉLECTIONNÉS (toggle clair) et appelle onToggle", () => {
    const { onToggle } = setup([
      { label: "LIMITATION_LIABILITY", role: "primary" },
      { label: "ARBITRATION_DISPUTES", role: "secondary" },
    ]);
    // Présent sur principal + secondaire, absent sur un non-sélectionné.
    expect(screen.getByTestId("deselect-LIMITATION_LIABILITY")).toBeInTheDocument();
    expect(screen.getByTestId("deselect-ARBITRATION_DISPUTES")).toBeInTheDocument();
    expect(screen.queryByTestId("deselect-TERMINATION")).toBeNull();
    fireEvent.click(screen.getByTestId("deselect-LIMITATION_LIABILITY"));
    expect(onToggle).toHaveBeenCalledWith("LIMITATION_LIABILITY"); // retrait du principal
  });

  it("refuge désactivé en secondaire quand un primaire différent existe", () => {
    const { onToggle } = setup([{ label: "LIMITATION_LIABILITY", role: "primary" }]);
    const refugeOpt = screen.getByTestId("theme-option-PREAMBLE_SCOPE");
    expect(refugeOpt).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(refugeOpt);
    expect(onToggle).not.toHaveBeenCalled(); // clic ignoré
  });

  it("refuge cliquable comme primaire quand aucun primaire", () => {
    const { onToggle } = setup([]);
    const refugeOpt = screen.getByTestId("theme-option-PREAMBLE_SCOPE");
    expect(refugeOpt).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(refugeOpt);
    expect(onToggle).toHaveBeenCalledWith("PREAMBLE_SCOPE");
  });

  it("indice LLM discret affiché sur l'option proposée", () => {
    setup([], { judgeHints: { ARBITRATION_DISPUTES: ["Claude", "Codex"] } });
    const hint = screen.getByTestId("llm-hint-ARBITRATION_DISPUTES");
    expect(hint).toHaveTextContent("CC"); // initiales
    expect(hint).toHaveAttribute("title", expect.stringContaining("Claude"));
  });
});
