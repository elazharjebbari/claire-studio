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

describe("TocPanel — un bloc par phrase (annotée ou « à annoter »)", () => {
  it("affiche UN bloc par phrase non annotée (pas un résumé) + encart de couverture", () => {
    // 10 phrases, annotées 0..6 → 3 phrases « à annoter » : 7, 8, 9.
    seed(10, [0, 1, 2, 3, 4, 5, 6]);
    render(<TocPanel docTitle="Academia" />);

    expect(screen.getByTestId("toc-coverage")).toHaveTextContent("7/10");
    expect(screen.getByTestId("toc-coverage")).toHaveTextContent("3 restantes");

    // 7 chips de clause + 3 blocs « à annoter ».
    expect(screen.getAllByTestId("clause-chip")).toHaveLength(7);
    const empties = screen.getAllByTestId("plan-empty");
    expect(empties).toHaveLength(3);
    expect(empties.map((e) => e.getAttribute("data-index"))).toEqual(["7", "8", "9"]);
    expect(empties[0]).toHaveTextContent("[7]");
    expect(empties[0]).toHaveTextContent("à annoter");
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

  it("cliquer un bloc « à annoter » focalise sa phrase", () => {
    seed(10, [0, 1, 2, 3, 4, 5, 6]);
    render(<TocPanel docTitle="Academia" />);
    const empty9 = screen.getAllByTestId("plan-empty").find((e) => e.getAttribute("data-index") === "9")!;
    fireEvent.click(empty9);
    expect(useWorkspaceStore.getState().focusedSentence).toBe(9);
  });

  it("document entièrement annoté : un chip par phrase, aucun bloc « à annoter », pas d'encart restant", () => {
    seed(3, [0, 1, 2]);
    render(<TocPanel docTitle="Doc" />);
    expect(screen.getAllByTestId("clause-chip")).toHaveLength(3);
    expect(screen.queryByTestId("plan-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("toc-coverage")).not.toBeInTheDocument();
    expect(screen.queryByTestId("toc-goto-gap")).not.toBeInTheDocument();
  });
});
