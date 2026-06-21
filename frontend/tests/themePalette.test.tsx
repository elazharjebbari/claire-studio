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
