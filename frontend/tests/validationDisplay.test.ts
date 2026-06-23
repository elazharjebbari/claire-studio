import { describe, expect, it } from "vitest";

import { validationDisplay, provenanceOf, secondaryCount } from "@/lib/validationDisplay";
import type { ThemeTag } from "@/types/contract";

describe("validationDisplay — 3 types de validation (forme=provenance, couleur=état)", () => {
  it("non validé → ◷ ambre (état à valider)", () => {
    const d = validationDisplay({ validated: false, seededFrom: "claude" });
    expect(d.state).toBe("a_valider");
    expect(d.glyph).toBe("◷");
    expect(d.colorClass).toContain("amber");
  });

  it("validé via le moteur (triageLevel) → ⚡ + niveau, vert", () => {
    const d = validationDisplay({ validated: true, triageLevel: "C2", seededFrom: "claude" });
    expect(d.provenance).toBe("moteur"); // priorité moteur > pré-annotation
    expect(d.level).toBe("C2");
    expect(d.glyph).toBe("⚡");
    expect(d.colorClass).toContain("emerald");
    expect(d.label).toMatch(/moteur/i);
  });

  it("validé depuis une pré-annotation (seededFrom, sans triageLevel) → ★", () => {
    const d = validationDisplay({ validated: true, seededFrom: "codex" });
    expect(d.provenance).toBe("pre_annotation");
    expect(d.glyph).toBe("★");
    expect(d.label).toMatch(/pré-annotation/i);
  });

  it("validé manuellement (ni seed ni triage) → ✎", () => {
    const d = validationDisplay({ validated: true });
    expect(d.provenance).toBe("manuel");
    expect(d.glyph).toBe("✎");
    expect(d.label).toMatch(/manuel/i);
  });

  it("provenanceOf : priorité moteur > pré-annotation > manuel", () => {
    expect(provenanceOf({ triageLevel: "C3", seededFrom: "x" })).toBe("moteur");
    expect(provenanceOf({ seededFrom: "x" })).toBe("pre_annotation");
    expect(provenanceOf({})).toBe("manuel");
  });

  it("secondaryCount compte les rôles secondaires", () => {
    const themes: ThemeTag[] = [
      { label: "A", role: "primary" },
      { label: "B", role: "secondary" },
      { label: "C", role: "secondary" },
    ];
    expect(secondaryCount(themes)).toBe(2);
    expect(secondaryCount(undefined)).toBe(0);
    expect(secondaryCount([{ label: "A", role: "primary" }])).toBe(0);
  });
});
