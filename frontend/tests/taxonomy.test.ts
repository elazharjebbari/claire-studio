/**
 * Taxonomies T20/T14/T11/T10 côté frontend — projection pure et PARITÉ avec Python.
 *
 * Les deux implémentations (ce module et `research/pactiva_lab/taxonomy.py`) lisent le
 * MÊME fichier de spécification. Ce test asserte les mêmes invariants que son miroir
 * `research/tests/test_taxonomy.py` : si l'un des deux dérive, la paire casse.
 */
import { describe, expect, it } from "vitest";

import {
  CANONICAL_TAXONOMY,
  POPULATIONS,
  TAXONOMIES,
  TAXONOMY_IDS,
  TAXONOMY_SPEC_VERSION,
  categoryOfTheme,
  getCategory,
  getTaxonomy,
  isHoldoutDocument,
  isMacroCategory,
  membersOf,
  projectTheme,
  projectThemeSet,
  type TaxonomyId,
} from "@/lib/taxonomy";
import { presentTheme, presentationTooltip } from "@/lib/taxonomy/presentation";
import { getThemeIcon } from "@/lib/themeIcons";

const T20_CODES = getTaxonomy("T20").categories.map((c) => c.code);

describe("Spécification", () => {
  it("est versionnée, canonique sur T20, et expose 4 taxonomies", () => {
    expect(TAXONOMY_SPEC_VERSION).toBeGreaterThanOrEqual(1);
    expect(CANONICAL_TAXONOMY).toBe("T20");
    expect(TAXONOMY_IDS).toEqual(["T20", "T14", "T11", "T10"]);
  });

  it("⭐ chaque taxonomie PARTITIONNE les 20 thèmes canoniques (ni trou ni doublon)", () => {
    expect(T20_CODES).toHaveLength(20);
    for (const taxonomy of TAXONOMIES) {
      const members = taxonomy.categories.flatMap((c) => c.members);
      expect(new Set(members).size, `${taxonomy.id} : doublon`).toBe(members.length);
      expect(new Set(members)).toEqual(new Set(T20_CODES));
    }
  });

  it("a les tailles annoncées", () => {
    expect(TAXONOMIES.map((t) => t.categories.length)).toEqual([20, 14, 11, 10]);
  });
});

describe("Projection", () => {
  it("est l'identité sur la taxonomie canonique", () => {
    for (const code of T20_CODES) expect(projectTheme(code, "T20")).toBe(code);
  });

  it("est déterministe et idempotente", () => {
    for (const code of T20_CODES) {
      for (const id of ["T14", "T11", "T10"] as TaxonomyId[]) {
        const once = projectTheme(code, id);
        expect(projectTheme(once, id)).toBe(once);
      }
    }
  });

  it("laisse passer un code inconnu (jamais de donnée escamotée)", () => {
    expect(projectTheme("THEME_INCONNU", "T11")).toBe("THEME_INCONNU");
    expect(projectTheme(null, "T11")).toBe("");
    expect(projectTheme(undefined, "T11")).toBe("");
  });

  it("⭐ déduplique : deux thèmes fusionnés ⇒ la clause devient mono-étiquette", () => {
    expect(projectThemeSet(["LICENSE_IP", "USER_CONTENT"], "T11")).toEqual(["CONTENT_IP"]);
    expect(projectThemeSet(["LICENSE_IP", "USER_CONTENT"], "T20")).toEqual([
      "LICENSE_IP",
      "USER_CONTENT",
    ]);
    // L'ordre du jeu d'origine est préservé.
    expect(projectThemeSet(["FEES_PAYMENT", "DMCA", "LICENSE_IP"], "T11")).toEqual([
      "FEES_PAYMENT",
      "CONTENT_IP",
    ]);
  });

  it("⭐ garde-fou des strates : T11 sépare responsabilité et garanties, T10 les fusionne", () => {
    expect(projectTheme("LIMITATION_LIABILITY", "T11")).toBe("LIMITATION_LIABILITY");
    expect(projectTheme("WARRANTY_DISCLAIMER", "T11")).toBe("WARRANTY_DISCLAIMER");
    expect(projectTheme("LIMITATION_LIABILITY", "T10")).toBe("RISK_ALLOCATION");
    expect(projectTheme("WARRANTY_DISCLAIMER", "T10")).toBe("RISK_ALLOCATION");
  });
});

describe("Lisibilité et traçabilité", () => {
  it("⭐ une macro-catégorie dit quels thèmes T20 elle contient", () => {
    const content = getCategory("CONTENT_IP", "T11");
    expect(content?.label).toMatch(/Contenu/);
    expect(isMacroCategory(content)).toBe(true);
    // Ordre de la spécification : le PREMIER membre est le thème-tête (il détermine le
    // glyphe de la macro-catégorie), donc on l'asserte tel quel plutôt que trié.
    expect(membersOf("CONTENT_IP", "T11")).toEqual([
      "LICENSE_IP", "USER_CONTENT", "DMCA", "FEEDBACK",
    ]);
    // Une classe non fusionnée ne déclenche pas l'affichage du détail.
    expect(isMacroCategory(getCategory("PRIVACY_DATA", "T11"))).toBe(false);
  });

  it("résout la catégorie d'un thème T20 en un appel (projection + résolution)", () => {
    const cat = categoryOfTheme("DMCA", "T11");
    expect(cat?.code).toBe("CONTENT_IP");
    expect(cat?.color).toBeTruthy();
    expect(categoryOfTheme("DMCA", "T20")?.label).toBe("DMCA / contrefaçon");
  });

  it("toute catégorie porte libellé, description et couleur ; les fusions s'expliquent", () => {
    for (const taxonomy of TAXONOMIES) {
      for (const c of taxonomy.categories) {
        expect(c.label.trim()).not.toBe("");
        expect(c.description.trim()).not.toBe("");
        expect(c.color).toMatch(/^#/);
        if (c.members.length > 1) expect(c.description.length).toBeGreaterThan(80);
      }
    }
  });

  it("les refuges survivent aux fusions (un refuge n'est jamais secondaire)", () => {
    for (const id of ["T14", "T11", "T10"] as TaxonomyId[]) {
      const refuges = getTaxonomy(id).categories.filter((c) => c.isRefuge);
      expect(refuges.length).toBeGreaterThan(0);
      const covered = new Set(refuges.flatMap((c) => c.members));
      expect(covered.has("PREAMBLE_SCOPE") && covered.has("MISC_BOILERPLATE")).toBe(true);
    }
  });
});

describe("Populations (anti-contamination)", () => {
  it("⭐ conception (33) et hold-out (17) sont disjointes et couvrent les 50 documents", () => {
    const design = new Set(POPULATIONS.designSet.documents);
    const holdout = new Set(POPULATIONS.holdout.documents);
    expect(design.size).toBe(33);
    expect(holdout.size).toBe(17);
    expect([...design].filter((d) => holdout.has(d))).toEqual([]);
    expect(new Set([...design, ...holdout]).size).toBe(50);
  });

  it("⭐ la spécification est INALTÉRABLE par ses appelants (tri en place)", () => {
    const first = membersOf("CONTENT_IP", "T11");
    first.sort(); // mutation du tableau RENVOYÉ, qui doit être une copie
    expect(membersOf("CONTENT_IP", "T11")[0]).toBe("LICENSE_IP");
  });

  it("identifie un document de validation", () => {
    expect(isHoldoutDocument("Skype")).toBe(true);
    expect(isHoldoutDocument("9gag")).toBe(false);
  });
});

describe("Présentation (rendu taxonomie-conscient)", () => {
  it("⭐ une macro-catégorie reçoit libellé, couleur, description ET glyphe", () => {
    const p = presentTheme("DMCA", "T11");
    expect(p.code).toBe("CONTENT_IP");
    expect(p.canonicalCode).toBe("DMCA"); // la donnée canonique reste accessible
    expect(p.label).toMatch(/Contenu/);
    expect(p.color).toMatch(/^#/);
    expect(p.isMerged).toBe(true);
    expect(p.members).toHaveLength(4);
    // Glyphe dérivé du thème-TÊTE (LICENSE_IP → Copyright) et NON le glyphe de repli :
    // sans cela, les cinq macro-catégories seraient visuellement indistinguables.
    // On compare les noms d'affichage : deux instances du même composant Lucide ne sont
    // pas garanties identiques par référence sous le résolveur de modules des tests.
    const nameOf = (icon: unknown) => (icon as { displayName?: string })?.displayName;
    expect(nameOf(p.icon)).toBe(nameOf(getThemeIcon("LICENSE_IP")));
    expect(nameOf(p.icon)).not.toBe(nameOf(getThemeIcon("CODE_INCONNU")));
  });

  it("en T20 la présentation est celle du thème lui-même", () => {
    const p = presentTheme("DMCA", "T20");
    expect(p.code).toBe("DMCA");
    expect(p.isMerged).toBe(false);
    expect((p.icon as { displayName?: string }).displayName).toBe(
      (getThemeIcon("DMCA") as { displayName?: string }).displayName,
    );
  });

  it("l'info-bulle énumère les thèmes T20 contenus", () => {
    const tip = presentationTooltip("USER_CONTENT", "T11");
    expect(tip).toMatch(/Regroupe 4 thèmes T20/);
    expect(tip).toMatch(/DMCA/);
  });
});
