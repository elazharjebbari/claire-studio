import { describe, expect, it } from "vitest";
import { placeWithinViewport } from "@/components/workspace/useAnchoredPosition";

const VW = 1000;
const VH = 800;

describe("placeWithinViewport (P2 — menu/popover dans le viewport)", () => {
  it("garde la position si tout tient", () => {
    expect(placeWithinViewport(100, 100, 200, 300, VW, VH)).toEqual({ left: 100, top: 100 });
  });

  it("flippe vers le haut quand ça déborde en bas (clic près du bas)", () => {
    // y=780, h=300 → 780+300 > 800 → flip : top = 780 - 300 = 480
    const { top } = placeWithinViewport(100, 780, 200, 300, VW, VH);
    expect(top).toBe(480);
  });

  it("flippe vers la gauche quand ça déborde à droite", () => {
    // x=950, w=200 → 950+200 > 1000 → flip : left = 950 - 200 = 750
    const { left } = placeWithinViewport(950, 100, 200, 300, VW, VH);
    expect(left).toBe(750);
  });

  it("clampe aux bords si même le flip déborde (popover plus grand que l'espace)", () => {
    // Coin bas-droit avec un grand popover → reste entièrement visible (marge 8).
    const { left, top } = placeWithinViewport(995, 795, 400, 400, VW, VH, 8);
    expect(left).toBe(VW - 400 - 8); // 592
    expect(top).toBe(VH - 400 - 8); // 392
    expect(left).toBeGreaterThanOrEqual(8);
    expect(top).toBeGreaterThanOrEqual(8);
  });

  it("ne sort jamais par le haut/gauche (marge minimale)", () => {
    const { left, top } = placeWithinViewport(2, 2, 200, 300, VW, VH, 8);
    expect(left).toBe(8);
    expect(top).toBe(8);
  });
});
