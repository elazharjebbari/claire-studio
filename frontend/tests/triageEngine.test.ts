import { describe, expect, it } from "vitest";
import { triageEngine, RULES } from "@/lib/triage";
import type { BoundaryVotes, ThemeVotes } from "@/lib/triage";
import golden from "@/lib/triage/golden.cases.json";

/** Helpers — 3 juges (claude, codex, mistral), codes APP canoniques. */
const tv = (c: string, x: string, m: string): ThemeVotes => ({ claude: c, codex: x, mistral: m });
const bv = (c: boolean, x: boolean, m: boolean): BoundaryVotes => ({ claude: c, codex: x, mistral: m });
const run = (themes: ThemeVotes, b: BoundaryVotes) => triageEngine(themes, b, RULES);

const ALL = bv(true, true, true); // frontière 3/3 (dure)
const SOFT = bv(true, true, false); // frontière 2/3 (molle)

describe("triageEngine — golden set (codes APP)", () => {
  it("T01 C1 — unanime + frontière dure → batch_accept mono", () => {
    const r = run(tv("PREAMBLE_SCOPE", "PREAMBLE_SCOPE", "PREAMBLE_SCOPE"), ALL)!;
    expect(r.level).toBe("C1");
    expect(r.action).toBe("batch_accept");
    expect(r.labelMode).toBe("mono");
    expect(r.needsHuman).toBe(false);
    expect(r.labels).toEqual([{ label: "PREAMBLE_SCOPE", role: "primary", support: 3 }]);
    expect(r.boundary).toEqual({ type: "hard", support: 3 });
  });

  it("T02 C2 — unanime + frontière molle → confirm", () => {
    const r = run(tv("ARBITRATION_DISPUTES", "ARBITRATION_DISPUTES", "ARBITRATION_DISPUTES"), SOFT)!;
    expect(r.level).toBe("C2");
    expect(r.action).toBe("confirm");
    expect(r.boundary).toEqual({ type: "soft", support: 2 });
    expect(r.needsHuman).toBe(true);
  });

  it("T03 C2 — override anti-refuge (majorité précise + 1 refuge MISC)", () => {
    const r = run(tv("FEES_PAYMENT", "FEES_PAYMENT", "MISC_BOILERPLATE"), ALL)!;
    expect(r.level).toBe("C2");
    expect(r.labelMode).toBe("mono");
    expect(r.labels[0]!.label).toBe("FEES_PAYMENT");
    expect(r.override).toEqual({ kind: "refuge_to_precis", from: "MISC_BOILERPLATE", to: "FEES_PAYMENT" });
    expect(r.explanation.logic).toContain("override anti-refuge");
  });

  it("T04 C3 — cluster + préséance LICENSE_IP>ACCEPTABLE_USE (primaire ≠ majorité)", () => {
    const r = run(tv("ACCEPTABLE_USE", "ACCEPTABLE_USE", "LICENSE_IP"), ALL)!;
    expect(r.level).toBe("C3");
    expect(r.action).toBe("validate_set");
    expect(r.labelMode).toBe("multi");
    const primary = r.labels.find((l) => l.role === "primary")!;
    const secondary = r.labels.find((l) => l.role === "secondary")!;
    expect(primary.label).toBe("LICENSE_IP"); // préséance bat la majorité
    expect(secondary.label).toBe("ACCEPTABLE_USE");
    // SCHEMA.md item 15 : le primaire (préséance) a MOINS de votes que le secondaire.
    expect(primary.support).toBe(1);
    expect(secondary.support).toBe(2);
  });

  it("T05 C3 — cluster + préséance LICENSE_IP>USER_CONTENT", () => {
    const r = run(tv("USER_CONTENT", "LICENSE_IP", "LICENSE_IP"), ALL)!;
    expect(r.level).toBe("C3");
    expect(r.labels.find((l) => l.role === "primary")!.label).toBe("LICENSE_IP");
    expect(r.labels.find((l) => l.role === "secondary")!.label).toBe("USER_CONTENT");
  });

  it("T06 C3 — cluster sans préséance → primaire par majorité", () => {
    const r = run(tv("ELIGIBILITY_ACCOUNT", "FEES_PAYMENT", "FEES_PAYMENT"), ALL)!;
    expect(r.level).toBe("C3");
    expect(r.labels.find((l) => l.role === "primary")!.label).toBe("FEES_PAYMENT");
    expect(r.labels.find((l) => l.role === "secondary")!.label).toBe("ELIGIBILITY_ACCOUNT");
  });

  it("T07 C4 — majorité hors refuge/cluster → verify", () => {
    const r = run(tv("ARBITRATION_DISPUTES", "ARBITRATION_DISPUTES", "META"), ALL)!;
    expect(r.level).toBe("C4");
    expect(r.action).toBe("verify");
    expect(r.labelMode).toBe("mono");
    expect(r.labels[0]!.label).toBe("ARBITRATION_DISPUTES");
    expect(r.explanation.logic).toContain("META"); // minoritaire montré
  });

  it("T08 C4 — majorité + frontière molle", () => {
    const r = run(tv("TERMINATION", "TERMINATION", "PRIVACY_DATA"), SOFT)!;
    expect(r.level).toBe("C4");
    expect(r.boundary.type).toBe("soft");
  });

  it("T09 C5 — éclaté (refuge + bruit), aucun cluster → arbitrate open", () => {
    const r = run(tv("PREAMBLE_SCOPE", "THIRD_PARTY_SERVICES", "GOVERNING_LAW"), ALL)!;
    expect(r.level).toBe("C5");
    expect(r.action).toBe("arbitrate");
    expect(r.labelMode).toBe("open");
    expect(r.labels).toEqual([]);
    expect(r.candidates.length).toBe(3);
  });

  it("T10 C5 — éclaté sans couple cluster", () => {
    const r = run(tv("META", "GOVERNING_LAW", "TERMINATION"), ALL)!;
    expect(r.level).toBe("C5");
  });

  it("T11 C3 — éclaté MAIS couple cluster présent (sans refuge)", () => {
    const r = run(tv("LICENSE_IP", "USER_CONTENT", "GOVERNING_LAW"), ALL)!;
    expect(r.level).toBe("C3");
    expect(r.labels.find((l) => l.role === "primary")!.label).toBe("LICENSE_IP");
    expect(r.labels.find((l) => l.role === "secondary")!.label).toBe("USER_CONTENT");
  });

  it("T12 C2 — override anti-refuge (PREAMBLE_SCOPE écarté)", () => {
    const r = run(tv("WARRANTY_DISCLAIMER", "WARRANTY_DISCLAIMER", "PREAMBLE_SCOPE"), ALL)!;
    expect(r.level).toBe("C2");
    expect(r.override?.from).toBe("PREAMBLE_SCOPE");
    expect(r.override?.to).toBe("WARRANTY_DISCLAIMER");
  });

  it("T13 dégradé — < 2 juges → null (carte masquée)", () => {
    expect(triageEngine({ claude: "LICENSE_IP" }, { claude: true }, RULES)).toBeNull();
  });

  it("T14 C3 — couple cluster bat C4 (majorité + dissident clusterisés)", () => {
    const r = run(tv("LIMITATION_LIABILITY", "LIMITATION_LIABILITY", "WARRANTY_DISCLAIMER"), ALL)!;
    expect(r.level).toBe("C3");
    expect(r.labels.find((l) => l.role === "primary")!.label).toBe("LIMITATION_LIABILITY");
    expect(r.labels.find((l) => l.role === "secondary")!.label).toBe("WARRANTY_DISCLAIMER");
  });

  it("T15 C5 — éclaté avec 2 refuges (aucun couple cluster exploitable)", () => {
    const r = run(tv("PREAMBLE_SCOPE", "MISC_BOILERPLATE", "THIRD_PARTY_SERVICES"), ALL)!;
    expect(r.level).toBe("C5");
  });
});

describe("triageEngine — normalisation d'alias & collapse", () => {
  it("normalise les codes bruts du protocole (DISPUTE_ARBITRATION → ARBITRATION_DISPUTES)", () => {
    const r = run(tv("DISPUTE_ARBITRATION", "DISPUTE_ARBITRATION", "DISPUTE_ARBITRATION"), ALL)!;
    expect(r.level).toBe("C1");
    expect(r.labels[0]!.label).toBe("ARBITRATION_DISPUTES");
  });

  it("collapse DEFINITIONS→PREAMBLE_SCOPE : majorité = refuge → C5 arbitrage (jamais un refuge primaire 'verify')", () => {
    // DEFINITIONS x2 (→PREAMBLE_SCOPE refuge) + META : la majorité EST un refuge (κ=0,18),
    // peu fiable → arbitrage (et non C4 mono-refuge). Dégradation ASSUMÉE du collapse :
    // le scheme app n'a pas DEFINITIONS, donc on ne peut pas reproduire un primaire substantiel.
    const r = run(tv("DEFINITIONS", "DEFINITIONS", "META"), ALL)!;
    expect(r.level).toBe("C5");
    expect(r.action).toBe("arbitrate");
    expect(r.labelMode).toBe("open");
    expect(r.labels).toEqual([]);
    expect(r.candidates).toContain("PREAMBLE_SCOPE");
    expect(r.candidates).toContain("META");
  });
});

describe("triageEngine — exemples RÉELS du protocole (echantillon_items.json, réconciliés)", () => {
  it("id 0 → C1 (PREAMBLE_SCOPE unanime, frontière dure)", () => {
    expect(run(tv("PREAMBLE_SCOPE", "PREAMBLE_SCOPE", "PREAMBLE_SCOPE"), ALL)!.level).toBe("C1");
  });
  it("id 2 → C2 (PREAMBLE_SCOPE unanime, frontière molle 1/3)", () => {
    const r = run(tv("PREAMBLE_SCOPE", "PREAMBLE_SCOPE", "PREAMBLE_SCOPE"), bv(false, false, true))!;
    expect(r.level).toBe("C2");
    expect(r.boundary).toEqual({ type: "soft", support: 1 });
  });
  it("id 15 → C3 (cluster, primaire LICENSE_IP sup.1 + secondaire ACCEPTABLE_USE sup.2)", () => {
    const r = run(tv("ACCEPTABLE_USE", "ACCEPTABLE_USE", "LICENSE_IP"), ALL)!;
    expect(r.level).toBe("C3");
    expect(r.labels).toEqual([
      { label: "LICENSE_IP", role: "primary", support: 1 },
      { label: "ACCEPTABLE_USE", role: "secondary", support: 2 },
    ]);
  });
  it("id 3 → C5 (DEFINITIONS x2 + META collapse en majorité-refuge → arbitrage)", () => {
    expect(run(tv("DEFINITIONS", "DEFINITIONS", "META"), ALL)!.level).toBe("C5");
  });
  it("id 7 → C5 (PREAMBLE_SCOPE + THIRD_PARTY + DEFINITIONS → PREAMBLE_SCOPE x2 majoritaire-refuge)", () => {
    const r = run(tv("PREAMBLE_SCOPE", "THIRD_PARTY", "DEFINITIONS"), ALL)!;
    expect(r.level).toBe("C5");
    expect(r.candidates).toContain("PREAMBLE_SCOPE");
    expect(r.candidates).toContain("THIRD_PARTY_SERVICES"); // THIRD_PARTY normalisé
  });
});

describe("triageEngine — généralisation K≥4 (ordre-indépendant)", () => {
  it("majorité + cluster NON en tête des dissidents → C3 (cluster scanné sur tous)", () => {
    // K=5 : LIMITATION_LIABILITY x3 (majorité) + META + WARRANTY_DISCLAIMER (cluster avec la majorité)
    const votes = { a: "LIMITATION_LIABILITY", b: "LIMITATION_LIABILITY", c: "LIMITATION_LIABILITY", d: "META", e: "WARRANTY_DISCLAIMER" };
    const b = { a: true, b: true, c: true, d: true, e: true };
    const r = triageEngine(votes, b, RULES)!;
    expect(r.level).toBe("C3");
    expect(r.labels.find((l) => l.role === "primary")!.label).toBe("LIMITATION_LIABILITY");
    expect(r.labels.find((l) => l.role === "secondary")!.label).toBe("WARRANTY_DISCLAIMER");
  });
  it("cluster PRIME sur override, indépendamment de l'ordre des juges", () => {
    // maj LICENSE_IP x3 + USER_CONTENT (cluster) + PREAMBLE_SCOPE (refuge) → toujours C3
    const order1 = { a: "LICENSE_IP", b: "LICENSE_IP", c: "LICENSE_IP", d: "USER_CONTENT", e: "PREAMBLE_SCOPE" };
    const order2 = { a: "LICENSE_IP", b: "LICENSE_IP", c: "LICENSE_IP", d: "PREAMBLE_SCOPE", e: "USER_CONTENT" };
    const bb = { a: true, b: true, c: true, d: true, e: true };
    expect(triageEngine(order1, bb, RULES)!.level).toBe("C3");
    expect(triageEngine(order2, bb, RULES)!.level).toBe("C3");
  });
  it("majorité-refuge (2 refuges + 1 précis) → C5, jamais refuge primaire", () => {
    const r = run(tv("PREAMBLE_SCOPE", "PREAMBLE_SCOPE", "GOVERNING_LAW"), ALL)!;
    expect(r.level).toBe("C5");
    expect(r.labels).toEqual([]);
  });
});

describe("triageEngine — invariants (balayage exhaustif 3 juges, frontière dure)", () => {
  const CODES = RULES.priority; // 20 codes app canoniques
  it("respecte tous les invariants du protocole sur 20³ combinaisons", () => {
    let count = 0;
    for (const a of CODES) {
      for (const b of CODES) {
        for (const c of CODES) {
          const r = run(tv(a, b, c), ALL);
          expect(r).not.toBeNull();
          if (!r) continue;
          count++;
          // niveau valide
          expect(["C1", "C2", "C3", "C4", "C5"]).toContain(r.level);
          // candidats toujours présents
          expect(r.candidates.length).toBeGreaterThan(0);
          // needsHuman faux ⇔ C1
          expect(r.needsHuman).toBe(r.level !== "C1");
          if (r.labelMode === "open") {
            // open ⇒ labels vide + C5
            expect(r.labels).toEqual([]);
            expect(r.level).toBe("C5");
          } else {
            // exactement un primaire
            expect(r.labels.filter((l) => l.role === "primary").length).toBe(1);
            // aucun refuge en secondaire
            for (const l of r.labels) {
              if (l.role === "secondary") expect(RULES.refuges).not.toContain(l.label);
            }
          }
          // multi ⇒ exactement 2 étiquettes (1 primaire + 1 secondaire)
          if (r.labelMode === "multi") expect(r.labels.length).toBe(2);
          // mono ⇒ 1 étiquette primaire
          if (r.labelMode === "mono") expect(r.labels.length).toBe(1);
          // un REFUGE n'est JAMAIS primaire en C3/C4 (autorisé seulement en C1/C2 unanime)
          if (r.level === "C3" || r.level === "C4") {
            const primary = r.labels.find((l) => l.role === "primary");
            if (primary) expect(RULES.refuges).not.toContain(primary.label);
          }
          // explication complète
          expect(r.explanation.context.length).toBeGreaterThan(0);
          expect(r.explanation.decision.length).toBeGreaterThan(0);
          expect(r.explanation.logic.length).toBeGreaterThan(0);
          // version de règles tracée
          expect(r.rulesVersion).toBe(RULES.version);
        }
      }
    }
    expect(count).toBe(CODES.length ** 3);
  });

  it("est déterministe (mêmes entrées → même sortie)", () => {
    const t = tv("ACCEPTABLE_USE", "ACCEPTABLE_USE", "LICENSE_IP");
    expect(run(t, ALL)).toEqual(run(t, ALL));
  });

  it("unanime + frontière dure ⇒ toujours C1 (pour tout code)", () => {
    for (const code of CODES) {
      expect(run(tv(code, code, code), ALL)!.level).toBe("C1");
    }
  });

  it("supporte K=2 juges (couple cluster → C3, sinon C5)", () => {
    const cluster = triageEngine({ claude: "LICENSE_IP", codex: "USER_CONTENT" }, { claude: true, codex: true }, RULES)!;
    expect(cluster.level).toBe("C3");
    const noCluster = triageEngine({ claude: "GOVERNING_LAW", codex: "TERMINATION" }, { claude: true, codex: true }, RULES)!;
    expect(noCluster.level).toBe("C5");
  });
});

describe("triageEngine — golden set PARTAGÉ (contrat de parité front/back)", () => {
  it("rulesVersion du golden == RULES.version", () => {
    expect((golden as { rulesVersion: string }).rulesVersion).toBe(RULES.version);
  });
  for (const c of (golden as { cases: GoldenCase[] }).cases) {
    it(`${c.id}`, () => {
      const r = triageEngine(c.votes as ThemeVotes, c.boundary as BoundaryVotes, RULES)!;
      expect(r).not.toBeNull();
      expect(r.level).toBe(c.expect.level);
      expect(r.action).toBe(c.expect.action);
      expect(r.labelMode).toBe(c.expect.labelMode);
      expect(r.needsHuman).toBe(c.expect.needsHuman);
      expect(r.boundary.type).toBe(c.expect.boundaryType);
      const primary = r.labels.find((l) => l.role === "primary")?.label ?? null;
      const secondary = r.labels.find((l) => l.role === "secondary")?.label ?? null;
      expect(primary).toBe(c.expect.primary);
      expect(secondary).toBe(c.expect.secondary);
      if (c.expect.override) {
        expect(r.override?.from).toBe(c.expect.override.from);
        expect(r.override?.to).toBe(c.expect.override.to);
      } else {
        expect(r.override).toBeUndefined();
      }
    });
  }
});

interface GoldenCase {
  id: string;
  votes: Record<string, string>;
  boundary: Record<string, boolean>;
  expect: {
    level: string; action: string; labelMode: string; needsHuman: boolean;
    boundaryType: string; primary: string | null; secondary: string | null;
    override: { from: string; to: string } | null;
  };
}
