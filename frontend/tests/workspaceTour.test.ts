import { describe, expect, it } from "vitest";
import {
  WORKSPACE_TOUR_STEPS,
  tourConfig,
} from "@/lib/tour/workspaceTour";

describe("Configuration de la visite guidée du workspace", () => {
  it("définit au moins une étape", () => {
    expect(WORKSPACE_TOUR_STEPS.length).toBeGreaterThan(0);
  });

  it("chaque étape a une section + un sélecteur non vide + un popover titre/description", () => {
    for (const step of WORKSPACE_TOUR_STEPS) {
      expect(step.section.trim().length, `section vide pour ${step.element}`).toBeGreaterThan(0);
      expect(step.element.trim().length, "sélecteur vide").toBeGreaterThan(0);
      expect(step.title.trim().length, `titre vide pour ${step.element}`).toBeGreaterThan(0);
      expect(
        step.description.trim().length,
        `description vide pour ${step.element}`,
      ).toBeGreaterThan(0);
    }
  });

  it("ne décrit plus l'annulation/rétablissement comme « à venir » (undo/redo réels)", () => {
    for (const step of WORKSPACE_TOUR_STEPS) {
      expect(step.description.toLowerCase()).not.toContain("à venir");
    }
  });

  it("préfixe le titre du DriveStep par la section (sauf l'étape finale)", () => {
    const cfg = tourConfig(WORKSPACE_TOUR_STEPS);
    const first = cfg.steps?.[0];
    expect(first?.popover?.title).toContain(" · ");
  });

  it("cible des sélecteurs basés sur data-testid ou aria-label", () => {
    // Autorise l'opérateur de préfixe `^=` (ex. boundary-peek-<index> dynamique).
    for (const step of WORKSPACE_TOUR_STEPS) {
      expect(step.element).toMatch(/\[(data-testid|aria-label)\^?=/);
    }
  });

  it("inclut les cibles clés du workspace", () => {
    const selectors = WORKSPACE_TOUR_STEPS.map((s) => s.element);
    for (const expected of [
      '[data-testid="annotation-workspace"]',
      '[aria-label="Plan du document"]',
      '[aria-label="Document"]',
      '[data-testid="inspector"]',
      '[data-testid="theme-palette"]',
      '[data-testid="certainty-picker"]',
      '[data-testid="prefill-switch"]',
      '[data-testid="toc-overlays-summary"]',
      '[data-testid="snapshot-btn"]',
      '[data-testid="submit-btn"]',
      // Blocs récents désormais couverts par la visite refondue (N-way + UI à jour)
      '[data-testid="selection-tools"]',
      '[data-testid="legal-nature"]',
      '[data-testid="reading-controls"]',
      '[data-testid="llm-source-switch"]',
      '[data-testid="toggle-history"]',
    ]) {
      expect(selectors, `cible manquante ${expected}`).toContain(expected);
    }
  });

  it("tourConfig() mappe chaque TourStep sur un DriveStep avec popover", () => {
    const cfg = tourConfig(WORKSPACE_TOUR_STEPS);
    expect(cfg.steps).toHaveLength(WORKSPACE_TOUR_STEPS.length);
    expect(cfg.nextBtnText).toBe("Suivant");
    expect(cfg.doneBtnText).toBe("Terminer");
    for (const ds of cfg.steps ?? []) {
      expect(typeof ds.element).toBe("string");
      expect(ds.popover?.title?.length ?? 0).toBeGreaterThan(0);
      expect(ds.popover?.description?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
