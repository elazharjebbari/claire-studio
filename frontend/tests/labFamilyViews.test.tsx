/**
 * Vues ad-hoc par famille (lot L3, docs/pactiva-lab-resultats/04 §4) : plancher,
 * résultat principal, multi-label T2, frontières T3 — verdict, KPIs et références
 * de tâche adaptés à l'objectif décisionnel de chaque preset.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { buildVerdict } from "@/features/lab/resultViews";
import { resultViewFor } from "@/features/lab/resultView";
import type { RunDetail } from "@/features/lab/types";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

vi.mock("@/features/lab/api", () => ({
  getRun: vi.fn(),
  listRuns: vi.fn(),
  cancelRun: vi.fn(),
  compareRuns: vi.fn(),
}));

/** Base commune — reflet fidèle d'un run RÉEL camélisé (embeddings ca4c7a9e, prod). */
const BASE: RunDetail = {
  id: "run-1",
  experiment: "exp-1",
  experimentName: "test",
  preset: "",
  task: "T1_primary",
  status: "succeeded",
  progress: 100,
  phase: "",
  macroF1: 0.4953,
  errorCode: "",
  createdAt: "2026-08-14T00:00:00Z",
  completedAt: "2026-08-14T00:01:00Z",
  computeTarget: "local",
  computeSite: null,
  startedAt: "2026-08-14T00:00:05Z",
  heartbeatAt: "2026-08-14T00:01:00Z",
  cancelRequested: false,
  config: {},
  environment: { gpu: { device: null, available: false }, python: "3.12.3", elapsedSeconds: 82.3 },
  externalJobId: "",
  errorDetail: "",
  attempt: 1,
  metrics: {
    task: "T1_primary",
    preprocess: "detok=regex_rules",
    metrics: {
      macroF1: 0.4953,
      microF1: 0.5961,
      kappa: 0.5634,
      ece: 0.4043,
      macroF1Ci: { point: 0.4969, low: 0.4602, high: 0.5397 },
      foldStats: {
        macroF1: { mean: 0.4953, std: 0.0209, min: 0.4616, max: 0.523, n: 5 },
      },
    },
    humanCeiling: {
      value: 0.494978,
      metric: "strict_agreement_rate",
      note: "Approximation calculée sur le dataset AGRÉGÉ (taux d'accord strict).",
      ci: { point: 0.494978, low: 0.471, high: 0.518 },
    },
    errors: {
      nErrors: 3081,
      byAgreementClass: {
        strict: { n: 6716, errors: 2626, rate: 0.391 },
        majority: { n: 427, errors: 157, rate: 0.3677 },
        divergence: { n: 478, errors: 298, rate: 0.6234 },
      },
    },
  },
};

async function renderRun(run: RunDetail) {
  const api = await import("@/features/lab/api");
  vi.mocked(api.getRun).mockResolvedValueOnce(run);
  const { RunResults } = await import("@/features/lab/RunResults");
  render(<RunResults slug="demo" runId={run.id} />, { wrapper: wrapper() });
  await waitFor(() => expect(screen.getByTestId("run-results")).toBeInTheDocument());
}

// --------------------------------------------------------------------------- //
// Famille A — plancher
// --------------------------------------------------------------------------- //

describe("famille plancher (baseline-fast / position-only)", () => {
  it("⭐ le verdict dit « plancher », pas « pourcentage du plafond » — question différente", async () => {
    await renderRun({ ...BASE, preset: "baseline-fast" });
    const verdict = screen.getByTestId("verdict-panel");
    expect(verdict.textContent).toContain("plancher TF-IDF");
    expect(verdict.textContent).toContain("[0.460 – 0.540]");
    expect(verdict.textContent).toMatch(/dépasser nettement/);
  });

  it("position-only nomme son plancher « positionnel »", () => {
    expect(
      buildVerdict({ ...BASE, preset: "position-only" }, resultViewFor({ preset: "position-only", task: "T1_primary" })),
    ).toContain("plancher positionnel");
  });

  it("l'intro du preset s'affiche (pédagogie branchée)", async () => {
    await renderRun({ ...BASE, preset: "baseline-fast" });
    expect(screen.getByTestId("experiment-intro").textContent).toContain(
      "aucun gain n'est interprétable",
    );
  });
});

// --------------------------------------------------------------------------- //
// Famille B — résultat principal
// --------------------------------------------------------------------------- //

describe("famille résultat principal (legal-bert-finetune)", () => {
  it("⭐ verdict en pourcentage du plafond humain approximé — formulation verrouillée", async () => {
    await renderRun({ ...BASE, preset: "legal-bert-finetune" });
    const verdict = screen.getByTestId("verdict-panel");
    expect(verdict.textContent).toContain("% du plafond humain approximé");
    expect(verdict.textContent).not.toMatch(/dépasse l'humain|bat l'humain/);
  });

  it("κ affiché en KPI (comparaison directe humains/LLM), avec sa dispersion", async () => {
    await renderRun({ ...BASE, preset: "legal-bert-finetune" });
    expect(screen.getByTestId("kpi-kappa").textContent).toContain("0.563");
  });

  it("⭐ le panneau par classe d'accord rend les 3 classes, divergence en tête d'erreur", async () => {
    await renderRun({ ...BASE, preset: "legal-bert-finetune" });
    const panel = screen.getByTestId("by-agreement-panel");
    // Libellés FRANÇAIS — jamais les clés anglaises brutes (revue adversariale).
    expect(panel.textContent).toContain("strict");
    expect(panel.textContent).toContain("majorité");
    expect(panel.textContent).toContain("divergence");
    expect(panel.textContent).toContain("62.3 %");
  });

  it("la bande de plafond porte l'IC du plafond lui-même", async () => {
    await renderRun({ ...BASE, preset: "legal-bert-finetune" });
    expect(screen.getByTestId("ceiling-band").textContent).toContain("[0.471 – 0.518]");
  });
});

// --------------------------------------------------------------------------- //
// Famille G — multi-label T2
// --------------------------------------------------------------------------- //

const T2_RUN: RunDetail = {
  ...BASE,
  preset: "multilabel-finetune",
  task: "T2_multilabel",
  metrics: {
    task: "T2_multilabel",
    metrics: {
      macroF1: 0.31,
      microF1: 0.52,
      lrap: 0.61,
      hammingLoss: 0.042,
      subsetAccuracy: 0.38,
      macroF1Ci: { point: 0.31, low: 0.27, high: 0.35 },
      foldStats: { macroF1: { mean: 0.31, std: 0.02, min: 0.28, max: 0.34, n: 5 } },
    },
    humanCeiling: { value: 0.51, metric: "strict_agreement_rate", note: "approximation" },
  },
};

describe("famille multi-label (multilabel-finetune)", () => {
  it("⭐ verdict : écart micro−macro assumé comme point de rigueur + plafond α-MASI", async () => {
    await renderRun(T2_RUN);
    const verdict = screen.getByTestId("verdict-panel");
    expect(verdict.textContent).toContain("écart micro−macro +0.210");
    expect(verdict.textContent).toContain("point de rigueur");
    expect(verdict.textContent).toContain("α-MASI 0,635");
  });

  it("KPIs T2 : LRAP, hamming, subset — jamais montrés avant ce lot", async () => {
    await renderRun(T2_RUN);
    expect(screen.getByTestId("kpi-lrap").textContent).toContain("0.610");
    expect(screen.getByTestId("kpi-hamming").textContent).toContain("0.042");
    expect(screen.getByTestId("kpi-subset").textContent).toContain("0.380");
  });

  it("⭐ la référence de tâche est α-MASI, pas κ — plafonds distincts par tâche", async () => {
    await renderRun(T2_RUN);
    const band = screen.getByTestId("task-reference-band");
    expect(band.textContent).toContain("α-MASI = 0,635");
    expect(band.textContent).toContain("pas κ");
  });
});

// --------------------------------------------------------------------------- //
// Famille H — frontières T3
// --------------------------------------------------------------------------- //

const T3_RUN: RunDetail = {
  ...BASE,
  preset: "sequence-boundary",
  task: "T3_boundary",
  metrics: {
    task: "T3_boundary",
    metrics: {
      macroF1: 0.44,
      microF1: 0.44,
      windowDiff: 0.31,
      boundaryPrecision: 0.52,
      boundaryRecall: 0.47,
      foldStats: { windowDiff: { mean: 0.31, std: 0.03, min: 0.27, max: 0.35, n: 5 } },
    },
    humanCeiling: { value: 0.48, metric: "strict_agreement_rate", note: "approximation" },
  },
};

describe("famille frontières (sequence-boundary)", () => {
  it("⭐ verdict : WindowDiff avec « plus bas = mieux » et fourchette humaine en repère", async () => {
    await renderRun(T3_RUN);
    const verdict = screen.getByTestId("verdict-panel");
    expect(verdict.textContent).toContain("WindowDiff 0.310");
    expect(verdict.textContent).toContain("plus bas = mieux");
    expect(verdict.textContent).toContain("0,39 – 0,63");
    expect(verdict.textContent).toContain("repère, pas comparaison directe");
  });

  it("KPIs T3 : WindowDiff, précision/rappel frontière — jamais montrés en KPI avant", async () => {
    await renderRun(T3_RUN);
    expect(screen.getByTestId("kpi-window-diff").textContent).toContain("0.310");
    expect(screen.getByTestId("kpi-boundary-precision").textContent).toContain("0.520");
    expect(screen.getByTestId("kpi-boundary-recall").textContent).toContain("0.470");
  });

  it("la référence de tâche est une FOURCHETTE Jaccard, pas un point", async () => {
    await renderRun(T3_RUN);
    expect(screen.getByTestId("task-reference-band").textContent).toContain("0,39 – 0,63");
    expect(screen.getByTestId("task-reference-band").textContent).toContain("FOURCHETTE");
  });
});

// --------------------------------------------------------------------------- //
// Verdicts — cas limites purs
// --------------------------------------------------------------------------- //

describe("buildVerdict — cas limites", () => {
  it("données manquantes → null, jamais une phrase inventée", () => {
    const empty = { ...BASE, metrics: { metrics: {} } } as RunDetail;
    expect(buildVerdict(empty, "floor")).toBeNull();
    expect(buildVerdict(empty, "multilabel")).toBeNull();
    expect(buildVerdict(empty, "boundary")).toBeNull();
    expect(buildVerdict(empty, "flagship")).toBeNull();
  });

  it("plafond absent → verdict flagship sans pourcentage (pas de division par rien)", () => {
    const noCeiling = {
      ...BASE,
      metrics: { ...BASE.metrics, humanCeiling: undefined },
    } as RunDetail;
    const verdict = buildVerdict(noCeiling, "flagship");
    expect(verdict).toContain("macro-F1 0.495");
    expect(verdict).not.toContain("%");
  });

  it("famille agrégée sur un run isolé → repli lecture flagship", () => {
    expect(buildVerdict({ ...BASE, preset: "embeddings-frozen" }, "paired")).toContain(
      "% du plafond humain approximé",
    );
  });
});
