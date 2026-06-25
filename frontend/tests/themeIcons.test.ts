import { describe, expect, it } from "vitest";
import { getThemeIcon } from "@/lib/themeIcons";
import { THEMES } from "@/lib/tokens";

describe("getThemeIcon — registre thème → glyphe Lucide", () => {
  it("associe une icône à chacun des thèmes du schéma", () => {
    for (const t of THEMES) {
      expect(getThemeIcon(t.code), `icône manquante pour ${t.code}`).toBeTypeOf("object");
    }
  });

  it("désambiguïse des thèmes de teinte proche par des FORMES distinctes", () => {
    // Trois familles « vertes/rouges/violettes » que la seule couleur distingue mal.
    const distincts = [
      getThemeIcon("TERMINATION"),
      getThemeIcon("LIMITATION_LIABILITY"),
      getThemeIcon("WARRANTY_DISCLAIMER"),
      getThemeIcon("ARBITRATION_DISPUTES"),
    ];
    expect(new Set(distincts).size).toBe(distincts.length);
  });

  it("repli neutre pour un code inconnu ou vide", () => {
    expect(getThemeIcon(undefined)).toBeTypeOf("object");
    expect(getThemeIcon("CODE_INEXISTANT")).toBeTypeOf("object");
  });
});
