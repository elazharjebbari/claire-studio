import { afterEach, describe, expect, it } from "vitest";
import { getThemeToken, readableTextColor, setRuntimeThemes } from "@/lib/tokens";

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

describe("setRuntimeThemes / getThemeToken (schéma via API, H4)", () => {
  afterEach(() => setRuntimeThemes(null));

  it("utilise les couleurs/labels du schéma API (corpus tiers aux codes inédits)", () => {
    setRuntimeThemes([{ code: "RISK_X", label: "Risque X", color: "#123456", order: 0 }]);
    const t = getThemeToken("RISK_X");
    expect(t.label).toBe("Risque X");
    expect(t.color).toBe("#123456");
  });

  it("replie sur le token statique si la couleur manque dans le schéma", () => {
    setRuntimeThemes([{ code: "META" }]); // schéma sans couleur pour META
    expect(getThemeToken("META").color).toBe("#6B7280"); // couleur statique META
  });

  it("réinitialise vers le statique avec null", () => {
    setRuntimeThemes([{ code: "META", color: "#000000" }]);
    expect(getThemeToken("META").color).toBe("#000000");
    setRuntimeThemes(null);
    expect(getThemeToken("META").color).toBe("#6B7280");
  });
});
