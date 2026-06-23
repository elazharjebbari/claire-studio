import { describe, expect, it } from "vitest";
import { highlightEvidence, hasEvidenceHint } from "@/lib/highlightEvidence";
import type { UnfairnessCategory } from "@/types/contract";

const join = (segs: { text: string }[]) => segs.map((s) => s.text).join("");

describe("highlightEvidence — repère indicatif intra-phrase", () => {
  it("non destructif : la concaténation des segments == le texte", () => {
    const t = "We may terminate or suspend your account at any time.";
    const segs = highlightEvidence(t, ["TER"]);
    expect(join(segs)).toBe(t);
  });

  it("marque le fragment matchant (TER)", () => {
    const segs = highlightEvidence("We may terminate your account.", ["TER"]);
    const marked = segs.filter((s) => s.mark).map((s) => s.text.toLowerCase());
    expect(marked.join(" ")).toContain("terminate");
    expect(segs.some((s) => !s.mark)).toBe(true); // du texte neutre subsiste
  });

  it("insensible à la casse", () => {
    const segs = highlightEvidence("BINDING ARBITRATION applies", ["A"]);
    expect(segs.some((s) => s.mark)).toBe(true);
  });

  it("multi-catégories : marque les fragments de chaque catégorie", () => {
    const t = "Provider shall not be liable; disputes go to binding arbitration.";
    const cats: UnfairnessCategory[] = ["LTD", "A"];
    const segs = highlightEvidence(t, cats);
    const marked = segs.filter((s) => s.mark).map((s) => s.text.toLowerCase()).join(" ");
    expect(marked).toContain("liable");
    expect(marked).toContain("arbitration");
    expect(join(segs)).toBe(t);
  });

  it("aucun match → un seul segment neutre (toute la phrase)", () => {
    const t = "Bonjour, ceci est une phrase neutre.";
    const segs = highlightEvidence(t, ["LTD"]);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ text: t, mark: false });
  });

  it("texte vide → segment vide", () => {
    expect(highlightEvidence("", ["A"])).toEqual([{ text: "", mark: false }]);
  });

  it("aucune catégorie → toute la phrase neutre", () => {
    const segs = highlightEvidence("anything", []);
    expect(segs).toEqual([{ text: "anything", mark: false }]);
  });

  it("hasEvidenceHint reflète la présence d'un repère", () => {
    expect(hasEvidenceHint("we may terminate", ["TER"])).toBe(true);
    expect(hasEvidenceHint("phrase neutre", ["TER"])).toBe(false);
  });
});
