import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Disclosure } from "@/components/ui/Disclosure";

describe("Disclosure — révélation progressive accessible", () => {
  it("replié par défaut : contenu monté mais masqué (a11y aria-expanded)", () => {
    render(
      <Disclosure testId="d" summary="Affichage">
        <button data-testid="inside">option</button>
      </Disclosure>,
    );
    const summary = screen.getByTestId("d-summary");
    expect(summary).toHaveAttribute("aria-expanded", "false");
    // Le contenu reste MONTÉ (présent dans le DOM) même replié → testids atteignables.
    const panel = screen.getByTestId("inside").closest("[hidden]");
    expect(panel).not.toBeNull();
  });

  it("clic sur le résumé déplie/replie (aria-expanded bascule)", () => {
    render(
      <Disclosure testId="d" summary="Affichage">
        <span>contenu</span>
      </Disclosure>,
    );
    const summary = screen.getByTestId("d-summary");
    fireEvent.click(summary);
    expect(summary).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(summary);
    expect(summary).toHaveAttribute("aria-expanded", "false");
  });

  it("badge « N actifs » affiché si > 0, masqué sinon", () => {
    const { rerender } = render(
      <Disclosure testId="d" summary="Affichage" badge={2}>
        <span>x</span>
      </Disclosure>,
    );
    expect(screen.getByTestId("d-badge")).toHaveTextContent("2");
    rerender(
      <Disclosure testId="d" summary="Affichage" badge={0}>
        <span>x</span>
      </Disclosure>,
    );
    expect(screen.queryByTestId("d-badge")).toBeNull();
  });

  it("defaultOpen=true révèle d'emblée", () => {
    render(
      <Disclosure testId="d" summary="Affichage" defaultOpen>
        <span>contenu</span>
      </Disclosure>,
    );
    expect(screen.getByTestId("d-summary")).toHaveAttribute("aria-expanded", "true");
  });
});
