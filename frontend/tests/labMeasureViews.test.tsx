/**
 * Vues ad-hoc des tâches de mesure et de graphe (M1/M2/G2) —
 * docs/pactiva-experiences-papiers/03 (L7) : chaque volet ouvre sur la décision de
 * l'expérience, les contrôles négatifs restent séparés des détecteurs, et rien
 * n'est calculé côté client.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import {
  AgreementPanels,
  CascadePanels,
  CooccurrencePanels,
} from "@/features/lab/measureViews";
import { resultViewFor } from "@/features/lab/resultView";
import { buildVerdict, FamilyKpis } from "@/features/lab/resultViews";
import type { RunDetail } from "@/features/lab/types";

afterEach(cleanup);

function baseRun(overrides: Partial<RunDetail["metrics"]> & { task: string }): RunDetail {
  return {
    id: "r1",
    experiment: "e1",
    experimentName: "exp",
    preset: "",
    task: overrides.task as RunDetail["task"],
    status: "succeeded",
    progress: 100,
    phase: "",
    macroF1: null,
    errorCode: "",
    createdAt: "",
    completedAt: null,
    computeTarget: "local",
    computeSite: null,
    startedAt: null,
    heartbeatAt: null,
    cancelRequested: false,
    config: {},
    metrics: overrides as RunDetail["metrics"],
    environment: {},
    externalJobId: "",
    errorDetail: "",
    attempt: 1,
  } as RunDetail;
}

const M1_RUN = baseRun({
  task: "M1_agreement",
  metrics: {
    alphaMasi: 0.635,
    alphaNominal: 0.701,
    alphaDiff: 0.066,
    kappaBestPair: 0.769,
    boundaryJaccardMean: 0.51,
    divergenceClosestMean: 0.42,
  },
  agreement: {
    global: {
      alphaMasi: 0.635,
      alphaNominal: 0.701,
      diff: 0.066,
      diffLow: 0.02,
      diffHigh: 0.11,
      pDirection: 0.03,
      nUnits: 1911,
      nDocuments: 4,
      ciMasi: { point: 0.635, low: 0.58, high: 0.69 },
      ciNominal: { point: 0.701, low: 0.65, high: 0.75 },
    },
    perTheme: [
      { theme: "PRIVACY_DATA", support: 120, alphaBinary: 0.89, gwetAc1: 0.93,
        observedAgreement: 0.97 },
      { theme: "META", support: 9, alphaBinary: 0.42, gwetAc1: 0.88,
        observedAgreement: 0.95 },
    ],
    pairs: [
      { a: "zahra", b: "elazhar", kappa: 0.769, rawAgreement: 0.8,
        jaccardMean: 0.74, nUnits: 783, nDocuments: 4 },
    ],
    matrix: {
      raters: ["elazhar", "zahra", "claude", "fable"],
      kinds: ["annotator", "annotator", "judge", "judge"],
      agreement: [
        [1, 0.8, 0.6, 0.53],
        [0.8, 1, 0.48, 0.43],
        [0.6, 0.48, 1, 0.81],
        [0.53, 0.43, 0.81, 1],
      ],
      kappa: [
        [1, 0.77, 0.5, 0.45],
        [0.77, 1, 0.4, 0.35],
        [0.5, 0.4, 1, 0.78],
        [0.45, 0.35, 0.78, 1],
      ],
      nCommon: [
        [0, 783, 700, 700],
        [783, 0, 6725, 6725],
        [700, 6725, 0, 9414],
        [700, 6725, 9414, 0],
      ],
    },
    boundaries: {
      pairs: [
        {
          a: "zahra", b: "elazhar", jaccardMean: 0.51,
          documents: [
            { document: "Atlas", jaccard: 0.625, nBoundariesA: 20, nBoundariesB: 22 },
            { document: "Airbnb", jaccard: 0.391, nBoundariesA: 90, nBoundariesB: 84 },
          ],
        },
      ],
      segments: [{ annotator: "zahra", nSegments: 3290, nSentences: 7508 }],
    },
    divergence: {
      annotators: [
        {
          annotator: "elazhar", nSentences: 783,
          byJudge: [
            { judge: "claude", nCommon: 783, divergencePrimary: 0.405, divergenceSet: 0.45 },
            { judge: "codex", nCommon: 783, divergencePrimary: 0.67, divergenceSet: 0.7 },
          ],
          closestJudge: "claude", closestDivergence: 0.405,
          perTheme: [{ theme: "TERMINATION", support: 60, divergence: 0.3 }],
        },
      ],
      closestRateMean: 0.405,
      note: "Divergence au juge le plus proche = borne INFÉRIEURE.",
    },
  },
});

const M2_RUN = baseRun({
  task: "M2_gold_cascade",
  metrics: {
    shareAuto1click: 0.52,
    shareAuto: 0.16,
    shareManual: 0.32,
    pctDecided: 0.7,
  },
  gold: {
    tiers: [
      { tier: "auto_1click", count: 222, share: 0.52 },
      { tier: "auto", count: 68, share: 0.16 },
      { tier: "manual", count: 135, share: 0.32 },
    ],
    agreementClasses: [{ agreementClass: "strict", count: 222 }],
    arbitration: { changed: 9, confirmed: 21, noPlurality: 4, manualTotal: 135,
      manualDecided: 34 },
    finalizedDocuments: [],
    coverage: 0.05,
    note: "État de la cascade tel qu'exporté.",
  },
});

const G2_RUN = baseRun({
  task: "G2_cooccurrence",
  metrics: {
    aucPrBestUnsupervised: 0.31,
    bestUnsupervisedScorer: "npmi_min",
    aucPrRarity: 0.22,
    aucPrComboIdentity: 0.47,
    baseRate: 0.104,
    nSegments: 3290,
  },
  cooccurrence: {
    structure: {
      nSegments: 3290, nSentences: 7508, compression: 2.28,
      nCombinations: 275, nHapax: 99, multiThemeRate: 0.3, baseRate: 0.104,
    },
    scorers: [
      { scorer: "npmi_min", kind: "unsupervised", aucPr: 0.31,
        aucPrCi: { low: 0.22, high: 0.4 }, rocAuc: 0.66,
        precisionAt: [{ k: 20, precision: 0.55, lift: 5.3 },
                      { k: 50, precision: 0.4, lift: 3.8 }] },
      { scorer: "cardinality", kind: "control", aucPr: 0.11,
        aucPrCi: { low: 0.08, high: 0.15 }, rocAuc: 0.51, precisionAt: [] },
      { scorer: "combo_identity", kind: "supervised_reference", aucPr: 0.47,
        aucPrCi: { low: 0.38, high: 0.55 }, rocAuc: 0.8,
        precisionAt: [{ k: 20, precision: 0.75, lift: 7.2 }] },
    ],
    combinations: {
      top: [
        { themes: ["LICENSE_IP", "TERMINATION"], support: 13, nUnfair: 10,
          unfairRate: 0.769, lift: 7.4,
          example: { document: "Atlas", start: 12, excerpt: "…" } },
      ],
      bottom: [],
      minSupport: 3,
    },
    perCategory: [
      { category: "LTD", nPositive: 296,
        aucPrByScorer: [{ scorer: "npmi_min", aucPr: 0.28 }] },
    ],
    unit: "segment",
    deontic: "none",
    labelNoise: 0,
    skippedScorers: [],
    note: "Aperçu sur annotations majoritairement mono-annotateur.",
  },
});

describe("routage des familles", () => {
  it("⭐ tâche et preset routent vers les vues ad-hoc M1/M2/G2", () => {
    expect(resultViewFor({ preset: "iaa-mesure", task: "M1_agreement" })).toBe("agreement");
    expect(resultViewFor({ preset: "gold-cascade", task: "M2_gold_cascade" })).toBe("cascade");
    expect(resultViewFor({ preset: "cooccurrence-abusivite", task: "G2_cooccurrence" }))
      .toBe("cooccurrence");
    expect(resultViewFor({ preset: "cooccurrence-bruit", task: "G2_cooccurrence" }))
      .toBe("cooccurrence");
    // Sans preset (mode expert), la tâche suffit.
    expect(resultViewFor({ preset: "", task: "M1_agreement" })).toBe("agreement");
    expect(resultViewFor({ preset: "", task: "G2_cooccurrence" })).toBe("cooccurrence");
  });
});

describe("verdicts", () => {
  it("⭐ E1 : le verdict chiffre le coût du multi-label et le franchissement du seuil", () => {
    const verdict = buildVerdict(M1_RUN, "agreement");
    expect(verdict).toContain("0.066");
    expect(verdict).toContain("0.635");
    expect(verdict).toContain("0.701");
    expect(verdict).toContain("seuil d'acceptabilité (0,667)");
  });

  it("cascade : le verdict donne la part automatique et le caveat aperçu", () => {
    const verdict = buildVerdict(M2_RUN, "cascade");
    expect(verdict).toContain("68.0 %");
    expect(verdict).toContain("aperçu");
  });

  it("⭐ G2 : le verdict nomme le meilleur détecteur NON supervisé et sépare la référence supervisée", () => {
    const verdict = buildVerdict(G2_RUN, "cooccurrence");
    expect(verdict).toContain("npmi_min");
    expect(verdict).toContain("référence supervisée");
    expect(verdict).toContain("Rare ≠ abusif");
  });

  it("aucun verdict inventé quand les métriques manquent", () => {
    const empty = baseRun({ task: "M1_agreement", metrics: {} });
    expect(buildVerdict(empty, "agreement")).toBeNull();
  });
});

describe("FamilyKpis", () => {
  it("agreement : les 6 cellules M1", () => {
    render(<FamilyKpis run={M1_RUN} family="agreement" />);
    expect(screen.getByTestId("kpi-alpha-masi").textContent).toContain("0.635");
    expect(screen.getByTestId("kpi-alpha-diff").textContent).toContain("0.066");
    expect(screen.getByTestId("kpi-boundary-jaccard").textContent).toContain("0.51");
  });

  it("cooccurrence : AUC-PR et référence supervisée étiquetée borne haute", () => {
    render(<FamilyKpis run={G2_RUN} family="cooccurrence" />);
    expect(screen.getByTestId("kpi-auc-pr-best").textContent).toContain("0.31");
    expect(screen.getByTestId("kpi-auc-pr-supervised").textContent).toContain(
      "PAS un détecteur",
    );
  });
});

describe("AgreementPanels", () => {
  it("⭐ rend E1 avec IC appariés, la matrice E2, les frontières E3 et la divergence E4", () => {
    render(<AgreementPanels run={M1_RUN} />);
    expect(screen.getByTestId("agreement-e1").textContent).toContain("0.066");
    expect(screen.getByTestId("agreement-e1").textContent).toContain("1911");
    const matrix = screen.getByTestId("agreement-matrix");
    expect(matrix.textContent).toContain("zahra");
    expect(matrix.textContent).toContain("fable");
    expect(matrix.textContent).toContain("80 %");
    expect(screen.getByTestId("agreement-boundaries").textContent).toContain("Atlas 0.63");
    const divergence = screen.getByTestId("agreement-divergence");
    expect(divergence.textContent).toContain("claude");
    expect(divergence.textContent).toContain("40.5 %");
    expect(divergence.textContent).toContain("borne INFÉRIEURE");
  });

  it("per-theme : trié par support, Gwet AC1 à côté de l'α", () => {
    render(<AgreementPanels run={M1_RUN} />);
    const table = screen.getByTestId("agreement-per-theme");
    const rows = table.textContent!;
    expect(rows.indexOf("PRIVACY_DATA")).toBeLessThan(rows.indexOf("META"));
    expect(rows).toContain("0.42");
    expect(rows).toContain("0.88");
  });

  it("rien ne s'affiche sans volet agreement", () => {
    const { container } = render(<AgreementPanels run={M2_RUN} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("CascadePanels", () => {
  it("⭐ tiers + « l'arbitre a contredit la pluralité » + caveat non-finalisé", () => {
    render(<CascadePanels run={M2_RUN} />);
    expect(screen.getByTestId("cascade-tiers").textContent).toContain("unanime");
    expect(screen.getByTestId("cascade-arbitration").textContent).toContain(
      "contredit la pluralité des votes 9 fois",
    );
    expect(screen.getByTestId("cascade-finalized").textContent).toContain(
      "Aucune résolution finalisée",
    );
  });
});

describe("CooccurrencePanels", () => {
  it("⭐ le tableau 5 groupe détecteurs / contrôles / référence supervisée", () => {
    render(<CooccurrencePanels run={G2_RUN} />);
    const table = screen.getByTestId("cooccurrence-scorers");
    const text = table.textContent!;
    expect(text.indexOf("Détecteurs non supervisés")).toBeLessThan(
      text.indexOf("Contrôles négatifs"),
    );
    expect(text.indexOf("Contrôles négatifs")).toBeLessThan(
      text.indexOf("Référence supervisée"),
    );
    expect(screen.getByTestId("scorer-npmi_min").textContent).toContain("0.310");
    expect(screen.getByTestId("scorer-cardinality").textContent).toContain("0.110");
  });

  it("structure + combinaisons à fort lift avec l'avertissement descriptif", () => {
    render(<CooccurrencePanels run={G2_RUN} />);
    expect(screen.getByTestId("cooccurrence-structure").textContent).toContain("3290");
    const combos = screen.getByTestId("cooccurrence-combinations");
    expect(combos.textContent).toContain("LICENSE_IP + TERMINATION");
    expect(combos.textContent).toContain("7.4×");
    expect(combos.textContent).toContain("SANS validation croisée");
  });

  it("⭐ les scorers sautés (sans sklearn) sont annoncés, jamais silencieux", () => {
    const run = baseRun({
      task: "G2_cooccurrence",
      metrics: G2_RUN.metrics!.metrics,
      cooccurrence: {
        ...G2_RUN.metrics!.cooccurrence!,
        skippedScorers: ["iforest", "lof", "ocsvm"],
      },
    });
    render(<CooccurrencePanels run={run} />);
    expect(screen.getByTestId("cooccurrence-skipped").textContent).toContain("iforest");
  });
});
