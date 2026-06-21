/**
 * L3/L4 — réglette des frontières par modèle : marqueur de frontière, clic-centrer,
 * piste sans données désactivée, toggles (modèle + catégorie) persistés.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  ModelBoundaryStrip,
  ModelBoundaryLegend,
  type GutterModel,
} from "@/components/workspace/ModelBoundaryRail";
import { useUiStore } from "@/store/ui";

const models: GutterModel[] = [
  {
    id: "claude",
    label: "Claude",
    initial: "C",
    hasData: true,
    identityColor: "#94A3B8",
    segments: [{ startSentence: 5, endSentence: 7, themeCode: "TERMINATION" }],
  },
  { id: "codex", label: "Codex", initial: "Cx", hasData: false, identityColor: "#A78BFA", segments: [] },
];

afterEach(cleanup);

describe("ModelBoundaryStrip (Feature A)", () => {
  it("marque la frontière au début de segment et recentre au clic", () => {
    const onJump = vi.fn();
    render(
      <ModelBoundaryStrip sentenceIndex={5} models={models} showCategory={false} onJump={onJump} />,
    );
    expect(screen.getByTestId("gutter-boundary-claude-5")).toBeTruthy();
    fireEvent.click(screen.getByTestId("gutter-cell-claude-5"));
    expect(onJump).toHaveBeenCalledWith(5);
  });

  it("cellule sans segment = désactivée (aucun recentrage)", () => {
    const onJump = vi.fn();
    render(
      <ModelBoundaryStrip sentenceIndex={0} models={models} showCategory={false} onJump={onJump} />,
    );
    const cell = screen.getByTestId("gutter-cell-claude-0") as HTMLButtonElement;
    expect(cell.disabled).toBe(true);
    fireEvent.click(cell);
    expect(onJump).not.toHaveBeenCalled();
  });

  it("corps de segment (sans frontière) reste une cellule active sans marqueur", () => {
    render(
      <ModelBoundaryStrip sentenceIndex={6} models={models} showCategory={false} onJump={vi.fn()} />,
    );
    expect(screen.queryByTestId("gutter-boundary-claude-6")).toBeNull();
    expect((screen.getByTestId("gutter-cell-claude-6") as HTMLButtonElement).disabled).toBe(false);
  });

  it("colonne conflit (D6c) : clic → 1re phrase de la zone de conflit", () => {
    const onJump = vi.fn();
    render(
      <ModelBoundaryStrip
        sentenceIndex={4}
        models={models}
        showCategory={false}
        onJump={onJump}
        conflictStart={2}
      />,
    );
    fireEvent.click(screen.getByTestId("gutter-conflict-4"));
    expect(onJump).toHaveBeenCalledWith(2);
  });
});

describe("ModelBoundaryLegend (Feature A)", () => {
  beforeEach(() => {
    useUiStore.setState({ gutterModels: {}, gutterShowCategory: false });
  });

  it("toggle d'un modèle met à jour (et persiste) le store", () => {
    render(<ModelBoundaryLegend models={models} />);
    fireEvent.click(screen.getByTestId("gutter-toggle-claude"));
    expect(useUiStore.getState().gutterModels.claude).toBe(false);
  });

  it("la piste sans données est désactivée dans la légende", () => {
    render(<ModelBoundaryLegend models={models} />);
    expect((screen.getByTestId("gutter-toggle-codex") as HTMLButtonElement).disabled).toBe(true);
  });

  it("toggle catégorie bascule l'affichage", () => {
    render(<ModelBoundaryLegend models={models} />);
    fireEvent.click(screen.getByTestId("gutter-toggle-category"));
    expect(useUiStore.getState().gutterShowCategory).toBe(true);
  });
});
