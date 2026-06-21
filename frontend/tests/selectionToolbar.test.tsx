/**
 * L2 — SelectionToolbar : les gestes de plage/bloc passent par applyBlockOp (lots).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SelectionToolbar } from "@/components/workspace/SelectionToolbar";
import { useWorkspaceStore } from "@/store/workspace";
import type { Clause } from "@/types/contract";

function clause(anchorIndex: number, theme = "META"): Clause {
  return { id: `c${anchorIndex}`, annotationId: "a1", anchorIndex, theme, order: anchorIndex };
}

beforeEach(() => {
  useWorkspaceStore.getState().reset();
});
afterEach(() => cleanup());

describe("SelectionToolbar (Feature B, L2)", () => {
  it("mode phrases : « Désannoter » retire la plage (un lot)", () => {
    useWorkspaceStore.getState().init({
      annotationId: "a1",
      nSentences: 10,
      clauses: [clause(2), clause(3), clause(4)],
    });
    useWorkspaceStore.getState().selectRange(2, 4);
    render(<SelectionToolbar />);
    fireEvent.click(screen.getByTestId("selection-desannotate"));
    const d = useWorkspaceStore.getState().draftClauses;
    expect(d.some((c) => [2, 3, 4].includes(c.anchorIndex))).toBe(false);
  });

  it("mode bloc : « Étendre ＋ » ajoute la phrase suivante au bloc", () => {
    useWorkspaceStore.getState().init({
      annotationId: "a1",
      nSentences: 10,
      clauses: [clause(2), clause(3), clause(4)],
    });
    const ids = useWorkspaceStore.getState().draftClauses.map((c) => c.localId);
    useWorkspaceStore.getState().setSelectedClauses(ids);
    render(<SelectionToolbar />);
    fireEvent.click(screen.getByTestId("block-extend"));
    expect(useWorkspaceStore.getState().draftClauses.find((c) => c.anchorIndex === 5)?.theme).toBe(
      "META",
    );
  });

  it("mode bloc : « Désannoter le bloc » retire tout le bloc (un lot)", () => {
    useWorkspaceStore.getState().init({
      annotationId: "a1",
      nSentences: 10,
      clauses: [clause(5), clause(6), clause(7)],
    });
    const ids = useWorkspaceStore.getState().draftClauses.map((c) => c.localId);
    useWorkspaceStore.getState().setSelectedClauses(ids);
    render(<SelectionToolbar />);
    fireEvent.click(screen.getByTestId("block-desannotate"));
    expect(useWorkspaceStore.getState().draftClauses).toHaveLength(0);
  });
});
