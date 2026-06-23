import { describe, expect, it } from "vitest";
import {
  UNFAIRNESS_META,
  SEVERITY_META,
  unfairnessMeta,
  severityMeta,
} from "@/lib/unfairnessMeta";

const CODES = ["A", "CH", "CR", "J", "LAW", "LTD", "TER", "USE"] as const;

describe("unfairnessMeta — métadonnées des 8 catégories", () => {
  it("couvre les 8 catégories avec sens + thèmes + lexique", () => {
    for (const c of CODES) {
      const m = UNFAIRNESS_META[c];
      expect(m, c).toBeDefined();
      expect(m.code).toBe(c);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.sense.toLowerCase()).toContain("clause qui");
      expect(m.relatedThemes.length).toBeGreaterThan(0);
      expect(m.keywords).toBeInstanceOf(RegExp);
    }
  });

  it("correspondances thématiques conformes à la doc", () => {
    expect(UNFAIRNESS_META.A.relatedThemes).toContain("ARBITRATION_DISPUTES");
    expect(UNFAIRNESS_META.LTD.relatedThemes).toEqual(
      expect.arrayContaining(["LIMITATION_LIABILITY", "WARRANTY_DISCLAIMER"]),
    );
    expect(UNFAIRNESS_META.TER.relatedThemes).toContain("TERMINATION");
    expect(UNFAIRNESS_META.J.relatedThemes).toContain("GOVERNING_LAW");
    expect(UNFAIRNESS_META.LAW.relatedThemes).toContain("GOVERNING_LAW");
    expect(UNFAIRNESS_META.CH.relatedThemes).toContain("MODIFICATION_OF_TERMS");
    expect(UNFAIRNESS_META.CR.relatedThemes).toEqual(
      expect.arrayContaining(["USER_CONTENT", "ACCEPTABLE_USE"]),
    );
    expect(UNFAIRNESS_META.USE.relatedThemes).toContain("PREAMBLE_SCOPE");
  });

  it("les lexiques matchent des exemples typiques", () => {
    expect("binding arbitration applies").toMatch(UNFAIRNESS_META.A.keywords);
    expect("we may terminate or suspend your account").toMatch(UNFAIRNESS_META.TER.keywords);
    expect("shall not be liable for any damages").toMatch(UNFAIRNESS_META.LTD.keywords);
    expect("provided as is without warranties").toMatch(UNFAIRNESS_META.LTD.keywords);
    expect("by using the service you agree").toMatch(UNFAIRNESS_META.USE.keywords);
    expect("governed by the laws of California").toMatch(UNFAIRNESS_META.LAW.keywords);
    // négatif : une phrase neutre ne matche pas LTD.
    expect("you can change your avatar").not.toMatch(UNFAIRNESS_META.LTD.keywords);
  });

  it("SEVERITY_META : 3 niveaux, tons et icônes cohérents", () => {
    expect(SEVERITY_META[1].tone).toBe("low");
    expect(SEVERITY_META[2].tone).toBe("mid");
    expect(SEVERITY_META[3].tone).toBe("high");
    expect(SEVERITY_META[1].icon).toBe("shield-check");
    expect(SEVERITY_META[3].icon).toBe("shield-alert");
    for (const lvl of [1, 2, 3] as const) {
      expect(SEVERITY_META[lvl].label.length).toBeGreaterThan(0);
      expect(SEVERITY_META[lvl].reading.length).toBeGreaterThan(0);
    }
  });

  it("accesseurs : code/niveau connus → meta, inconnus → undefined", () => {
    expect(unfairnessMeta("LTD")?.code).toBe("LTD");
    expect(unfairnessMeta("NOPE")).toBeUndefined();
    expect(severityMeta(3)?.tone).toBe("high");
    expect(severityMeta(9)).toBeUndefined();
  });
});
