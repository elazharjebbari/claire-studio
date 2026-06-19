import { describe, expect, it } from "vitest";
import { readableTextColor } from "@/lib/tokens";

describe("readableTextColor (contraste AA des pastilles à fond dynamique)", () => {
  it("choisit un texte quasi-noir sur un fond clair (cyan de présence)", () => {
    // #06b6d4 + blanc = 2.42 (échec AA) → le helper renvoie du quasi-noir (≈ 8.5:1).
    expect(readableTextColor("#06b6d4")).toBe("#0B0F14");
  });

  it("choisit du blanc sur un fond sombre", () => {
    expect(readableTextColor("#0B0F14")).toBe("#FFFFFF");
    expect(readableTextColor("#DC2626")).toBe("#FFFFFF");
  });

  it("tolère l'absence de # et replie sur blanc si non #RRGGBB", () => {
    expect(readableTextColor("06b6d4")).toBe("#0B0F14");
    expect(readableTextColor("rgb(1,2,3)")).toBe("#FFFFFF");
    expect(readableTextColor("")).toBe("#FFFFFF");
  });
});
