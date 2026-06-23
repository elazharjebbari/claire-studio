import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUnfairnessMarks, useUnfairnessIndex } from "@/components/workspace/useUnfairness";
import type { ReferenceLabel } from "@/types/contract";

function lbl(sentenceIndex: number, category: string, level: 1 | 2 | 3): ReferenceLabel {
  return { id: `${sentenceIndex}-${category}`, sentenceId: `s${sentenceIndex}`, sentenceIndex, category: category as ReferenceLabel["category"], level, source: "claudette" };
}

describe("useUnfairnessMarks / useUnfairnessIndex", () => {
  it("conserve TOUTES les marques d'une phrase, triées par sévérité ↓", () => {
    const labels = [lbl(4, "A", 2), lbl(4, "LTD", 3), lbl(7, "TER", 1)];
    const { result } = renderHook(() => useUnfairnessMarks(labels));
    const m4 = result.current.get(4)!;
    expect(m4).toHaveLength(2);
    expect(m4[0]!.category).toBe("LTD"); // niveau 3 en tête
    expect(m4[0]!.level).toBe(3);
    expect(m4[1]!.category).toBe("A");
    expect(result.current.get(7)).toHaveLength(1);
  });

  it("enrichit chaque marque avec le sens et les thèmes (meta)", () => {
    const { result } = renderHook(() => useUnfairnessMarks([lbl(0, "LTD", 3)]));
    const mark = result.current.get(0)![0]!;
    expect(mark.sense.toLowerCase()).toContain("responsabilité");
    expect(mark.relatedThemes).toContain("LIMITATION_LIABILITY");
    expect(mark.label.length).toBeGreaterThan(0);
    expect(mark.color).toMatch(/^#/);
  });

  it("tri déterministe à niveau égal (catégorie alphabétique)", () => {
    const { result } = renderHook(() => useUnfairnessMarks([lbl(1, "TER", 2), lbl(1, "A", 2)]));
    const m = result.current.get(1)!;
    expect(m.map((x) => x.category)).toEqual(["A", "TER"]);
  });

  it("useUnfairnessIndex renvoie la marque DOMINANTE (non-régression overlay)", () => {
    const labels = [lbl(4, "LTD", 1), lbl(4, "LTD", 3)];
    const { result } = renderHook(() => useUnfairnessIndex(labels));
    expect(result.current.get(4)?.level).toBe(3);
    expect(result.current.get(4)?.label).toMatch(/responsabilité/i);
  });
});
