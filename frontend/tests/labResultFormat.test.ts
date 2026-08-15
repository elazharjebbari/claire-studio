/** Formatage des grandeurs statistiques (`resultFormat.ts`) — fonctions pures. */

import { describe, expect, it } from "vitest";

import {
  deltaContainsZero,
  fmtCeilingShare,
  fmtCi,
  fmtDispersion,
  fmtMetric,
  fmtPValue,
  fmtSigned,
} from "@/features/lab/resultFormat";

describe("fmtMetric / fmtCi / fmtDispersion", () => {
  it("valeur → 3 décimales, absente → tiret", () => {
    expect(fmtMetric(0.5156)).toBe("0.516");
    expect(fmtMetric(null)).toBe("—");
    expect(fmtMetric(undefined)).toBe("—");
  });

  it("IC complet → crochets ; borne manquante → null (jamais un demi-IC)", () => {
    expect(fmtCi({ low: 0.482, high: 0.5578 })).toBe("[0.482 – 0.558]");
    expect(fmtCi({ low: null, high: 0.5 })).toBeNull();
    expect(fmtCi(null)).toBeNull();
  });

  it("dispersion → ± ; absente → null", () => {
    expect(fmtDispersion(0.0284)).toBe("± 0.028");
    expect(fmtDispersion(null)).toBeNull();
  });
});

describe("fmtSigned", () => {
  it("signe TOUJOURS explicite, y compris le moins typographique", () => {
    expect(fmtSigned(0.0204)).toBe("+0.020");
    expect(fmtSigned(-0.004)).toBe("−0.004");
    expect(fmtSigned(0)).toBe("+0.000");
    expect(fmtSigned(null)).toBe("—");
  });
});

describe("fmtPValue", () => {
  it("p ordinaire → 3 décimales", () => {
    expect(fmtPValue(0.1099)).toBe("p = 0.110");
  });

  it("⭐ sous la résolution du test → « p < 1/n » honnête, jamais un zéro impossible", () => {
    // Correction +1 : p minimal = 1/(n+1). À 2000 permutations, p=1/2001.
    expect(fmtPValue(1 / 2001, 2000)).toBe("p < 0.0005");
  });

  it("absente → mention explicite", () => {
    expect(fmtPValue(null)).toBe("p — indisponible");
  });
});

describe("fmtCeilingShare", () => {
  it("formulation verrouillée « X % du plafond humain approximé »", () => {
    expect(fmtCeilingShare(0.5155, 0.494978)).toBe("104 % du plafond humain approximé");
  });

  it("plafond absent ou nul → null (pas de pourcentage inventé)", () => {
    expect(fmtCeilingShare(0.5, null)).toBeNull();
    expect(fmtCeilingShare(0.5, 0)).toBeNull();
    expect(fmtCeilingShare(null, 0.49)).toBeNull();
  });
});

describe("deltaContainsZero", () => {
  it("distingue contient / exclut / indéterminé", () => {
    expect(deltaContainsZero({ low: -0.01, high: 0.04 })).toBe(true);
    expect(deltaContainsZero({ low: 0.004, high: 0.041 })).toBe(false);
    expect(deltaContainsZero({ low: null, high: 0.04 })).toBeNull();
  });
});
