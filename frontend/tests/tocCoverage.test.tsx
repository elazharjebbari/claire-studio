/**
 * Correctif « blocks manquants » (doc Academia : 193 phrases, 133 annotées) — le plan
 * expose les phrases NON annotées (ligne de trou + encart de couverture + saut).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TocPanel } from "@/components/workspace/TocPanel";
import { useWorkspaceStore } from "@/store/workspace";

beforeEach(() => {
  useWorkspaceStore.getState().reset();
  // jsdom n'implémente pas scrollIntoView (l'effet de synchro du chip sélectionné l'appelle).
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});
afterEach(cleanup);

function seed(nSentences: number, annotated: number[]) {
  act(() => {
    useWorkspaceStore.getState().init({ annotationId: "a1", nSentences, clauses: [] });
    for (const i of annotated) useWorkspaceStore.getState().setBoundary(i, "META");
  });
}

describe("TocPanel — couverture & phrases non annotées", () => {
  it("affiche l'encart de couverture et une ligne de trou groupée (cas Academia réduit)", () => {
    // 10 phrases, annotées 0..6 → trou 7..9 (3 phrases).
    seed(10, [0, 1, 2, 3, 4, 5, 6]);
    render(<TocPanel docTitle="Academia" />);

    expect(screen.getByTestId("toc-coverage")).toHaveTextContent("7/10");
    expect(screen.getByTestId("toc-coverage")).toHaveTextContent("3 restantes");

    const gap = screen.getByTestId("plan-gap");
    expect(gap).toHaveAttribute("data-range", "7-9");
    expect(gap).toHaveTextContent("3 phrases non annotées");
    expect(gap).toHaveTextContent("[7]–[9]");
  });

  it("le bouton « Prochaine non annotée » focalise la 1re phrase libre puis avance", () => {
    seed(10, [0, 1, 2, 3, 4, 5, 6]);
    render(<TocPanel docTitle="Academia" />);

    fireEvent.click(screen.getByTestId("toc-goto-gap"));
    expect(useWorkspaceStore.getState().focusedSentence).toBe(7);
    // focusedSentence est maintenant 7 → un nouveau clic avance à 8 (cyclage).
    fireEvent.click(screen.getByTestId("toc-goto-gap"));
    expect(useWorkspaceStore.getState().focusedSentence).toBe(8);
  });

  it("cliquer la ligne de trou saute à sa 1re phrase", () => {
    seed(10, [0, 1, 2, 3, 4, 5, 6]);
    render(<TocPanel docTitle="Academia" />);
    fireEvent.click(screen.getByTestId("plan-gap"));
    expect(useWorkspaceStore.getState().focusedSentence).toBe(7);
  });

  it("document entièrement annoté : ni encart restant, ni ligne de trou", () => {
    seed(3, [0, 1, 2]);
    render(<TocPanel docTitle="Doc" />);
    expect(screen.queryByTestId("toc-coverage")).not.toBeInTheDocument();
    expect(screen.queryByTestId("plan-gap")).not.toBeInTheDocument();
    expect(screen.queryByTestId("toc-goto-gap")).not.toBeInTheDocument();
  });
});
