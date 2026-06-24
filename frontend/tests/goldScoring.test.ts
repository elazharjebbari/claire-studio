/**
 * Moteur de scoring GOLD (miroir TS) — résolution PUREMENT inter-annotateurs.
 * Les LLM ne sont JAMAIS parties au conflit.
 */
import { describe, expect, it } from "vitest";
import { scoreSentence, defaultConfig, type Vote } from "@/lib/goldScoring";

const H = (id: string, primary: string | null, ...secondaries: string[]): Vote => ({
  voterId: id,
  primary,
  secondaries,
  isLlm: false,
});
const L = (id: string, primary: string | null): Vote => ({ voterId: id, primary, isLlm: true });

describe("scoreSentence — décision purement inter-annotateurs", () => {
  it("les annotateurs décident, les LLM divergents sont ignorés", () => {
    const s = scoreSentence([H("a1", "X"), H("a2", "X"), H("a3", "X"), L("c", "Y"), L("d", "Y"), L("m", "Y")]);
    expect(s.primary).toBe("X");
    expect(s.agreementClass).toBe("strict");
    expect(s.autoLevel).toBe("auto_1click");
    expect(s.llmBlock).toBe("Y"); // référence seulement
    expect(s.humanDissent).toBe(false);
  });

  it("accord strict des annotateurs malgré divergence LLM = PAS un conflit", () => {
    const s = scoreSentence([H("a1", "P"), H("a2", "P"), H("a3", "P"), L("c", "Q"), L("d", "Q"), L("m", "Q")]);
    expect(s.agreementClass).toBe("strict");
    expect(s.riskBand).toBe("low");
    expect(s.autoLevel).toBe("auto_1click");
  });

  it("ajouter des votes LLM ne change jamais le résultat", () => {
    const base = scoreSentence([H("a1", "X"), H("a2", "X"), H("a3", "Y")]);
    const withLlm = scoreSentence([H("a1", "X"), H("a2", "X"), H("a3", "Y"), L("c", "Z"), L("d", "Z"), L("m", "Z")]);
    expect(withLlm.primary).toBe(base.primary);
    expect(withLlm.agreementClass).toBe(base.agreementClass);
    expect(withLlm.riskBand).toBe(base.riskBand);
    expect(withLlm.autoLevel).toBe(base.autoLevel);
    expect(withLlm.confidence).toBe(base.confidence);
  });
});

describe("scoreSentence — classes & auto", () => {
  it("accord absolu → auto_1click, risque bas", () => {
    const s = scoreSentence([H("a1", "X", "S1"), H("a2", "X", "S1"), H("a3", "X", "S1")]);
    expect(s.agreementClass).toBe("strict");
    expect(s.autoLevel).toBe("auto_1click");
    expect(s.riskBand).toBe("low");
    expect(s.secondaries).toEqual(["S1"]);
    expect(s.confidence).toBe(1);
  });

  it("majorité 2/3 → auto", () => {
    const s = scoreSentence([H("a1", "X"), H("a2", "X"), H("a3", "Y")]);
    expect(s.agreementClass).toBe("majority");
    expect(s.autoLevel).toBe("auto");
  });

  it("divergence totale → manuel, risque haut", () => {
    const s = scoreSentence([H("a1", "X"), H("a2", "Y"), H("a3", "Z")]);
    expect(s.agreementClass).toBe("divergence");
    expect(s.riskBand).toBe("high");
    expect(s.autoLevel).toBe("manual");
  });

  it("aucun annotateur → empty + manual", () => {
    const s = scoreSentence([L("c", "Y"), L("d", "Y")]);
    expect(s.agreementClass).toBe("empty");
    expect(s.primary).toBeNull();
    expect(s.autoLevel).toBe("manual");
  });
});

describe("scoreSentence — secondaires & pondérations", () => {
  it("secondaire retenu si porté par ≥2 annotateurs", () => {
    const s = scoreSentence([H("a1", "X", "S1"), H("a2", "X", "S1"), H("a3", "X")]);
    expect(s.secondaries).toEqual(["S1"]);
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

  it("defaultConfig() est annotateur-only", () => {
    const c = defaultConfig();
    expect(c.annotatorWeight).toBe(1);
    expect(c).not.toHaveProperty("llmRole");
  });
});

describe("scoreSentence — déterminisme", () => {
  it("invariant par permutation", () => {
    const votes = [H("a1", "X"), H("a2", "Y"), H("a3", "X")];
    const a = scoreSentence(votes);
    const b = scoreSentence([...votes].reverse());
    expect(b.primary).toBe(a.primary);
    expect(b.agreementClass).toBe(a.agreementClass);
    expect(b.autoLevel).toBe(a.autoLevel);
  });
});
