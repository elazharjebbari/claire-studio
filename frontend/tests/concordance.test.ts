import { describe, expect, it } from "vitest";
import {
  themeVectorExact,
  judgeVectorsFromPre,
  intersectionAgreement,
  concordanceReport,
} from "@/lib/concordance";

describe("themeVectorExact (modèle humain per-sentence)", () => {
  it("place le thème à l'index EXACT, sans forward-fill", () => {
    const v = themeVectorExact(
      [
        { anchorIndex: 0, theme: "META" },
        { anchorIndex: 2, theme: "TERMINATION" },
      ],
      4,
    );
    expect(v).toEqual(["META", null, "TERMINATION", null]); // l'index 1 reste vide
  });

  it("ignore les ancres hors bornes et gère n<=0", () => {
    expect(themeVectorExact([{ anchorIndex: 9, theme: "X" }], 3)).toEqual([null, null, null]);
    expect(themeVectorExact([{ anchorIndex: 0, theme: "X" }], 0)).toEqual([]);
  });
});

describe("judgeVectorsFromPre (modèle de bloc, forward-fill)", () => {
  it("forward-fill le thème d'un juge depuis son ancre", () => {
    const vecs = judgeVectorsFromPre(
      { claude: { clauses: [{ anchorIndex: 0, themeCode: "META" }, { anchorIndex: 2, themeCode: "TERMINATION" }] } },
      4,
    );
    // forward-fill : 0,1 = META (couvre jusqu'à l'ancre suivante), 2,3 = TERMINATION
    expect(vecs.claude).toEqual(["META", "META", "TERMINATION", "TERMINATION"]);
  });
});

describe("intersectionAgreement", () => {
  it("ne compte que les phrases co-couvertes", () => {
    const a = ["META", null, "TERMINATION", "PRIVACY_DATA"];
    const b = ["META", "META", "ARBITRATION", "PRIVACY_DATA"];
    // co-couvertes : index 0 (✓), 2 (✗), 3 (✓) → 2/3
    const r = intersectionAgreement(a, b);
    expect(r.n).toBe(3);
    expect(r.matches).toBe(2);
    expect(r.pct).toBeCloseTo((2 / 3) * 100, 5);
  });

  it("renvoie pct null si aucune intersection", () => {
    expect(intersectionAgreement(["A", null], [null, "B"]).pct).toBeNull();
  });
});

describe("concordanceReport", () => {
  it("classe les juges par accord, désigne le meilleur, et calcule LLM↔LLM", () => {
    const human = ["META", "TERMINATION", "PRIVACY_DATA", null];
    const judges = {
      claude: ["META", "TERMINATION", "PRIVACY_DATA", "X"], // 3/3 sur l'intersection humaine
      codex: ["META", "ARBITRATION", "PRIVACY_DATA", "X"], // 2/3
      mistral: ["OTHER", "OTHER", "OTHER", "X"], // 0/3
    };
    const rep = concordanceReport(human, judges);

    // Meilleur accord = claude à 100%.
    expect(rep.bestMatch).toEqual({ judge: "claude", pct: 100 });
    // Ordre décroissant : claude > codex > mistral.
    expect(rep.perJudge.map((p) => p.judge)).toEqual(["claude", "codex", "mistral"]);
    expect(rep.perJudge[0]!.pct).toBe(100);
    expect(rep.perJudge[1]!.pct).toBeCloseTo((2 / 3) * 100, 5);
    expect(rep.perJudge[2]!.pct).toBe(0);

    // Couverture humaine = 3 phrases annotées.
    expect(rep.humanCovered).toBe(3);

    // LLM↔LLM : 3 paires (claude-codex, claude-mistral, codex-mistral).
    expect(rep.llmPairs).toHaveLength(3);
    expect(rep.llmMeanPct).not.toBeNull();
  });

  it("bestMatch null + pct null quand l'humain n'a rien annoté", () => {
    const rep = concordanceReport([null, null, null], {
      claude: ["META", "META", "META"],
    });
    expect(rep.bestMatch).toBeNull();
    expect(rep.perJudge[0]!.pct).toBeNull();
    expect(rep.humanCovered).toBe(0);
  });

  it("place les juges sans support en fin de classement", () => {
    const human = ["META", "TERMINATION"];
    const judges = {
      covered: ["META", "TERMINATION"],
      empty: [null, null],
    };
    const rep = concordanceReport(human, judges);
    expect(rep.perJudge[0]!.judge).toBe("covered");
    expect(rep.perJudge[1]!.judge).toBe("empty");
    expect(rep.perJudge[1]!.pct).toBeNull();
  });
});
