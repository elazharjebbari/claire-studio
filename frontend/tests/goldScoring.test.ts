/**
 * Moteur de scoring GOLD (miroir TS) — parité avec le backend + scénarios métier.
 */
import { describe, expect, it } from "vitest";
import { scoreSentence, defaultConfig, type Vote } from "@/lib/goldScoring";

const H = (id: string, primary: string | null, ...secondaries: string[]): Vote => ({
  voterId: id,
  primary,
  secondaries,
  isLlm: false,
});
const L = (id: string, primary: string | null, ...secondaries: string[]): Vote => ({
  voterId: id,
  primary,
  secondaries,
  isLlm: true,
});

describe("scoreSentence — annotateurs > LLM", () => {
  it("3 annotateurs (X) l'emportent sur 3 LLM (Y)", () => {
    const s = scoreSentence([H("a1", "X"), H("a2", "X"), H("a3", "X"), L("c", "Y"), L("d", "Y"), L("m", "Y")]);
    expect(s.primary).toBe("X");
    expect(s.humanBlock).toBe("X");
    expect(s.llmBlock).toBe("Y");
  });

  it("en rôle full, une masse LLM suffisante peut renverser", () => {
    const s = scoreSentence([H("a1", "X"), L("c", "Y"), L("d", "Y"), L("m", "Y"), L("n", "Y")], {
      llmRole: "full",
    });
    expect(s.primary).toBe("Y");
  });
});

describe("scoreSentence — signal fort (humain ≠ LLM)", () => {
  it("dissent → risque haut + manual", () => {
    const s = scoreSentence([H("a1", "X"), H("a2", "X"), H("a3", "X"), L("c", "Y"), L("d", "Y"), L("m", "Y")]);
    expect(s.humanDissent).toBe(true);
    expect(s.primary).toBe("X");
    expect(s.riskBand).toBe("high");
    expect(s.autoLevel).toBe("manual");
  });
});

describe("scoreSentence — accord absolu = 1 clic", () => {
  it("strict + secondaires identiques → auto_1click + risque bas", () => {
    const s = scoreSentence([H("a1", "X", "S1"), H("a2", "X", "S1"), H("a3", "X", "S1")]);
    expect(s.agreementClass).toBe("strict");
    expect(s.autoLevel).toBe("auto_1click");
    expect(s.riskBand).toBe("low");
    expect(s.secondaries).toEqual(["S1"]);
    expect(s.confidence).toBe(1);
  });
});

describe("scoreSentence — niveau auto", () => {
  it("LLM unanimes (≥3) + 2/3 annotateurs sans dissent → auto", () => {
    const s = scoreSentence([H("a1", "X"), H("a2", "X"), H("a3", "Y"), L("c", "X"), L("d", "X"), L("m", "X")]);
    expect(s.agreementClass).toBe("majority");
    expect(s.humanDissent).toBe(false);
    expect(s.autoLevel).toBe("auto");
  });

  it("LLM unanimes mais dissent → manual", () => {
    const s = scoreSentence([H("a1", "X"), H("a2", "X"), H("a3", "Z"), L("c", "Y"), L("d", "Y"), L("m", "Y")]);
    expect(s.humanDissent).toBe(true);
    expect(s.autoLevel).toBe("manual");
  });
});

describe("scoreSentence — divergence", () => {
  it("split total → divergence + risque haut + manual", () => {
    const s = scoreSentence([H("a1", "X"), H("a2", "Y"), H("a3", "Z")]);
    expect(s.agreementClass).toBe("divergence");
    expect(s.riskBand).toBe("high");
    expect(s.autoLevel).toBe("manual");
  });
});

describe("scoreSentence — secondaires & rôles", () => {
  it("secondaire retenu si porté par ≥2 annotateurs", () => {
    const s = scoreSentence([H("a1", "X", "S1"), H("a2", "X", "S1"), H("a3", "X")]);
    expect(s.secondaries).toEqual(["S1"]);
  });

  it("secondaire rejeté si un seul annotateur", () => {
    const s = scoreSentence([H("a1", "X", "S1"), H("a2", "X"), H("a3", "X")]);
    expect(s.secondaries).toEqual([]);
  });

  it("rôle ignore exclut les LLM de l'électorat", () => {
    const s = scoreSentence([H("a1", "X"), L("c", "Y"), L("d", "Y"), L("m", "Y"), L("n", "Y")], {
      llmRole: "ignore",
    });
    expect(s.primary).toBe("X");
    expect(s.tally).not.toHaveProperty("Y");
  });

  it("rôle tiebreak départage une égalité humaine", () => {
    const s = scoreSentence([H("a1", "X"), H("a2", "Y"), L("c", "Y"), L("d", "Y")], { llmRole: "tiebreak" });
    expect(s.primary).toBe("Y");
  });
});

describe("scoreSentence — cas dégénérés & pondérations", () => {
  it("aucun annotateur → empty + manual", () => {
    const s = scoreSentence([L("c", "Y"), L("d", "Y")]);
    expect(s.agreementClass).toBe("empty");
    expect(s.autoLevel).toBe("manual");
  });

  it("poids par annotateur renverse la majorité numérique", () => {
    const s = scoreSentence([H("a1", "X"), H("a2", "Y"), H("a3", "Y")], {
      perAnnotator: { a1: 10, a2: 1, a3: 1 },
    });
    expect(s.primary).toBe("X");
  });

  it("la fiabilité abaisse la confiance", () => {
    const s = scoreSentence([H("a1", "X"), H("a2", "X"), H("a3", "X")], { reliability: { X: 0.5 } });
    expect(s.confidence).toBe(0.5);
  });

  it("confiance toujours dans [0,1]", () => {
    const s = scoreSentence([H("a1", "X"), H("a2", "Y"), H("a3", "X"), L("c", "X")]);
    expect(s.confidence).toBeGreaterThanOrEqual(0);
    expect(s.confidence).toBeLessThanOrEqual(1);
  });
});

describe("scoreSentence — déterminisme", () => {
  it("invariant par permutation des votes", () => {
    const votes = [H("a1", "X"), H("a2", "Y"), L("c", "X"), L("d", "X"), L("m", "X")];
    const a = scoreSentence(votes);
    const b = scoreSentence([...votes].reverse());
    expect(b.primary).toBe(a.primary);
    expect(b.agreementClass).toBe(a.agreementClass);
    expect(b.autoLevel).toBe(a.autoLevel);
  });

  it("defaultConfig() pré-réglé « confiance annotateurs »", () => {
    const c = defaultConfig();
    expect(c.llmRole).toBe("tiebreak");
    expect(c.annotatorWeight).toBe(3);
    expect(c.llmWeight).toBe(1);
  });
});
