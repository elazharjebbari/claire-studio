import { describe, expect, it } from "vitest";
import {
  HELP_MANIFEST,
  HELP_GROUP_ORDER,
  helpGroups,
  helpSection,
} from "../content/help/manifest";
import { HELP_CONTENT, helpContent } from "../content/help";

describe("Manifeste du centre d'aide", () => {
  it("a des slugs uniques", () => {
    const slugs = HELP_MANIFEST.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("a un titre non vide pour chaque section", () => {
    for (const s of HELP_MANIFEST) {
      expect(s.title.trim().length).toBeGreaterThan(0);
    }
  });

  it("rattache chaque section à un groupe connu", () => {
    for (const s of HELP_MANIFEST) {
      expect(HELP_GROUP_ORDER).toContain(s.group);
    }
  });

  it("fournit un contenu Markdown non vide pour chaque slug du manifeste", () => {
    for (const s of HELP_MANIFEST) {
      const content = helpContent(s.slug);
      expect(content, `contenu manquant pour ${s.slug}`).toBeDefined();
      expect((content ?? "").trim().length).toBeGreaterThan(0);
    }
  });

  it("ne contient pas de contenu orphelin (chaque clé de HELP_CONTENT est dans le manifeste)", () => {
    const slugs = new Set(HELP_MANIFEST.map((s) => s.slug));
    for (const key of Object.keys(HELP_CONTENT)) {
      expect(slugs.has(key), `clé orpheline ${key}`).toBe(true);
    }
  });

  it("helpGroups() conserve l'ordre des groupes et n'inclut que des groupes peuplés", () => {
    const groups = helpGroups();
    const names = groups.map((g) => g.group);
    // Sous-séquence de HELP_GROUP_ORDER.
    let idx = 0;
    for (const n of names) {
      idx = HELP_GROUP_ORDER.indexOf(n, idx);
      expect(idx).toBeGreaterThanOrEqual(0);
    }
    for (const g of groups) {
      expect(g.sections.length).toBeGreaterThan(0);
    }
  });

  it("helpSection() retrouve une section par slug", () => {
    expect(helpSection("introduction")?.title).toBe("Introduction");
    expect(helpSection("inexistant")).toBeUndefined();
  });
});
