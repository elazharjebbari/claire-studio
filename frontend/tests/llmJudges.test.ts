import { describe, expect, it } from "vitest";
import { LLM_JUDGES, LLM_JUDGE_IDS, llmJudgeLabel, llmJudgeColor } from "@/lib/llmJudges";

describe("config des juges LLM (source unique N-modèles)", () => {
  it("ordonnés par taille de modèle décroissante : fable, claude, codex, mistral", () => {
    expect(LLM_JUDGE_IDS).toEqual(["fable", "claude", "codex", "mistral"]);
  });

  it("chaque juge a label, initiale et couleur d'identité distincte", () => {
    for (const j of LLM_JUDGES) {
      expect(j.label.trim().length).toBeGreaterThan(0);
      expect(j.initial.trim().length).toBeGreaterThan(0);
      expect(j.identityColor).toMatch(/^#/);
    }
    const colors = LLM_JUDGES.map((j) => j.identityColor);
    expect(new Set(colors).size).toBe(colors.length); // couleurs distinctes
  });

  it("helpers : label/couleur connus, repli si inconnu", () => {
    expect(llmJudgeLabel("mistral")).toBe("Mistral");
    expect(llmJudgeLabel("inconnu")).toBe("inconnu");
    expect(llmJudgeColor("mistral")).toBe("#5EEAD4");
  });
});
