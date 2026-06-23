/**
 * Info-bulle d'intention (describeOnHover) + descriptions de thèmes (doc annotateur).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { ThemePalette } from "@/components/ui/ThemePalette";
import { getThemeDescription } from "@/lib/themeDescriptions";
import { getThemeToken } from "@/lib/tokens";

afterEach(cleanup);

describe("getThemeDescription (doc annotateur)", () => {
  it("renvoie une description connue, vide pour un code inconnu", () => {
    expect(getThemeDescription("TERMINATION")).toMatch(/clôture|suspension/i);
    expect(getThemeDescription("UNKNOWN_X")).toBe("");
    expect(getThemeDescription(null)).toBe("");
  });
});

describe("ThemePalette — info-bulle d'intention", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("affiche le tooltip après ~450 ms (intention), pas instantanément", () => {
    render(<ThemePalette value={null} onChange={() => {}} layout="grid" describeOnHover />);
    fireEvent.mouseEnter(screen.getByTestId("theme-option-TERMINATION"));
    // Pas instantané.
    expect(screen.queryByTestId("theme-tooltip")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const tip = screen.getByTestId("theme-tooltip");
    expect(tip.textContent).toContain(getThemeToken("TERMINATION").label);
    expect(tip.textContent).toMatch(/clôture|suspension/i);
  });

  it("n'affiche aucune info-bulle sans describeOnHover", () => {
    render(<ThemePalette value={null} onChange={() => {}} />);
    fireEvent.mouseEnter(screen.getByTestId("theme-option-TERMINATION"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByTestId("theme-tooltip")).toBeNull();
  });
});

describe("ThemePalette — mode fill (remplit le panneau, anti-bande vide)", () => {
  it("liste : fill ajoute flex-1 (occupe la hauteur) au conteneur et à la liste", () => {
    render(<ThemePalette value={null} onChange={() => {}} fill />);
    const palette = screen.getByTestId("theme-palette");
    expect(palette.className).toContain("flex-1");
    const list = screen.getByRole("listbox");
    expect(list.className).toContain("flex-1");
    expect(list.className).not.toContain("max-h-64"); // plus de plafond fixe
  });

  it("sans fill : conteneur sans flex-1, liste plafonnée (max-h-64)", () => {
    render(<ThemePalette value={null} onChange={() => {}} />);
    expect(screen.getByTestId("theme-palette").className).not.toContain("flex-1");
    expect(screen.getByRole("listbox").className).toContain("max-h-64");
  });

  it("grid : fill n'altère pas la grille (pas de scroll, toutes catégories)", () => {
    render(<ThemePalette value={null} onChange={() => {}} layout="grid" fill />);
    const list = screen.getByRole("listbox");
    expect(list.className).toContain("grid");
    expect(list.className).not.toContain("flex-1");
  });
});
