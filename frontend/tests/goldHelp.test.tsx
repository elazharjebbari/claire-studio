/**
 * GoldHelpModal — modale expliquant la résolution + construction du gold (a11y, contenu, fermeture).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { GoldHelpModal } from "@/components/gold/GoldHelpModal";

afterEach(() => cleanup());

describe("GoldHelpModal", () => {
  it("est une modale accessible et explique les points clés", () => {
    render(<GoldHelpModal onClose={() => {}} />);
    const dlg = screen.getByTestId("gold-help-modal");
    expect(dlg).toHaveAttribute("role", "dialog");
    expect(dlg).toHaveAttribute("aria-modal", "true");
    // Message central : inter-annotateurs + LLM en référence.
    expect(screen.getByTestId("gold-help-interannot")).toBeInTheDocument();
    expect(screen.getByTestId("gold-help-llm-reference")).toHaveTextContent(/référence/i);
    expect(screen.getByTestId("gold-help-auto")).toBeInTheDocument();
    expect(screen.getByTestId("gold-help-arbitrage")).toBeInTheDocument();
    expect(screen.getByTestId("gold-help-export")).toBeInTheDocument();
  });

  it("se ferme via le bouton et via Échap", () => {
    const onClose = vi.fn();
    render(<GoldHelpModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId("gold-help-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("se ferme au clic sur l'arrière-plan", () => {
    const onClose = vi.fn();
    render(<GoldHelpModal onClose={onClose} />);
    const backdrop = screen.getByTestId("gold-help-modal").parentElement!;
    fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
