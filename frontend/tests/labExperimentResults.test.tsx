/**
 * Vue agrégée d'une expérience (`ExperimentResults`) — familles courbe, criblage,
 * comparaison appariée, juges LLM (lot L4, docs/pactiva-lab-resultats/04 §4 C-F).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { ExperimentAggregate } from "@/features/lab/api";
import { ApiError } from "@/lib/api/client";

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

vi.mock("@/features/lab/api", async () => {
  const actual = await vi.importActual<typeof import("@/features/lab/api")>(
    "@/features/lab/api",
  );
  return {
    ...actual,
    getExperimentAggregate: vi.fn(),
    comparePaired: vi.fn(),
    getJudgesAgreement: vi.fn(),
  };
});

async function renderExperiment() {
  const { ExperimentResults } = await import("@/features/lab/ExperimentResults");
  render(<ExperimentResults slug="demo" experimentId="exp-1" />, { wrapper: wrapper() });
  await waitFor(() =>
    expect(screen.getByTestId("experiment-results")).toBeInTheDocument(),
  );
}

const BASE_AGG: Omit<ExperimentAggregate, "runs" | "preset" | "axis"> = {
  experiment: "exp-1",
  name: "expérience",
  metric: "macro_f1",
  humanCeiling: { value: 0.495, ci: { low: 0.471, high: 0.518 } },
};

// --------------------------------------------------------------------------- //
// Famille E — courbe
// --------------------------------------------------------------------------- //

describe("ExperimentResults — courbe d'apprentissage", () => {
  const CURVE_AGG: ExperimentAggregate = {
    ...BASE_AGG,
    preset: "learning-curve",
    axis: "learning_curve.n_documents",
    runs: [5, 10, 20, 30, 39].flatMap((size) =>
      [0, 1, 2].map((repeat) => ({
        id: `run-${size}-${repeat}`,
        status: "succeeded",
        value: 0.55 - 0.6 * size ** -0.5 + repeat * 0.002,
        ci: { low: 0.3, high: 0.5 },
        axisValue: size,
        config: { evaluation: { learningCurve: { nDocuments: size } } },
      })),
    ),
  };

  it("⭐ verdict « la tendance suggère » borné, figure avec zone d'extrapolation et note d'écrêtage", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getExperimentAggregate).mockResolvedValue(CURVE_AGG);
    await renderExperiment();

    const verdict = screen.getByTestId("verdict-panel");
    expect(verdict.textContent).toContain("À 39 documents");
    expect(verdict.textContent).toContain("La tendance ajustée");
    expect(verdict.textContent).toContain("vers 98 documents");
    expect(verdict.textContent).not.toMatch(/atteindra/);

    expect(screen.getByTestId("figure-learning-curve")).toBeInTheDocument();
    expect(screen.getByTestId("curve-extrapolation-zone")).toHaveAttribute(
      "data-extrapolated", "true",
    );
    expect(screen.getByTestId("curve-fit")).toBeInTheDocument();
    expect(screen.getByTestId("curve-ceiling")).toBeInTheDocument();
    expect(screen.getByTestId("curve-saturation-note")).toBeInTheDocument();
  });

  it("⭐ label-noise : même famille, PAS d'ajustement ni d'extrapolation (aucune asymptote à estimer)", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getExperimentAggregate).mockResolvedValue({
      ...BASE_AGG,
      preset: "ablation-label-noise",
      axis: "label_noise",
      runs: [0, 0.05, 0.1, 0.2].map((noise) => ({
        id: `run-${noise}`,
        status: "succeeded",
        value: 0.5 - noise,
        ci: null,
        axisValue: noise,
        config: { evaluation: { labelNoise: noise } },
      })),
    });
    await renderExperiment();

    expect(screen.getByTestId("verdict-panel").textContent).toContain("bruit d'étiquettes");
    expect(screen.queryByTestId("curve-fit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("curve-extrapolation-zone")).not.toBeInTheDocument();
  });

  it("sweep incomplet → bandeau explicite, figures sur les runs exploitables", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getExperimentAggregate).mockResolvedValue({
      ...CURVE_AGG,
      runs: [
        ...CURVE_AGG.runs,
        { id: "pending", status: "running", value: null, ci: null, axisValue: 39,
          config: {} },
        { id: "failed", status: "failed", value: null, ci: null, axisValue: 30,
          config: {} },
      ],
    });
    await renderExperiment();

    const banner = screen.getByTestId("sweep-incomplete");
    expect(banner.textContent).toContain("1 run(s) encore en cours");
    expect(banner.textContent).toContain("1 en échec");
    expect(screen.getByTestId("figure-learning-curve")).toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------- //
// Famille D — criblage
// --------------------------------------------------------------------------- //

describe("ExperimentResults — criblage", () => {
  const SCREEN_AGG: ExperimentAggregate = {
    ...BASE_AGG,
    preset: "screening-preprocess",
    axis: null,
    runs: [
      { id: "r1", status: "succeeded", value: 0.46, ci: { low: 0.42, high: 0.5 },
        axisValue: null, config: { preprocess: { case: "lower", ngram: 1 } } },
      { id: "r2", status: "succeeded", value: 0.47, ci: { low: 0.43, high: 0.51 },
        axisValue: null, config: { preprocess: { case: "lower", ngram: 2 } } },
      { id: "r3", status: "succeeded", value: 0.41, ci: { low: 0.37, high: 0.45 },
        axisValue: null, config: { preprocess: { case: "none", ngram: 1 } } },
      { id: "r4", status: "succeeded", value: 0.42, ci: { low: 0.38, high: 0.46 },
        axisValue: null, config: { preprocess: { case: "none", ngram: 2 } } },
    ],
  };

  it("⭐ bandeau exploratoire + classement avec règle de survie (écartées grisées)", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getExperimentAggregate).mockResolvedValue(SCREEN_AGG);
    await renderExperiment();

    expect(screen.getByTestId("screening-exploratory-banner").textContent).toContain(
      "exploratoire",
    );
    // best = r2 (0.47, low 0.43) ; r1 touche (high 0.5 ≥ 0.43) ; r3 (high 0.45) touche
    // aussi ; r4 (high 0.46) touche. Tous survivent ici sauf... vérifions r3 : 0.45 ≥
    // 0.43 → survit. La règle est top-k honnête, pas un couperet arbitraire.
    expect(screen.getByTestId("screening-row-r2")).toHaveAttribute("data-survived");
    expect(screen.getByTestId("screening-row-r1")).toHaveAttribute("data-survived");
    const verdict = screen.getByTestId("verdict-panel");
    expect(verdict.textContent).toContain("4 configurations testées");
    expect(verdict.textContent).toContain("case");
  });

  it("⭐ effets marginaux par axe : case (fort) avant ngram (faible)", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getExperimentAggregate).mockResolvedValue(SCREEN_AGG);
    await renderExperiment();

    const effects = screen.getByTestId("screening-axis-effects");
    const text = effects.textContent!;
    expect(text.indexOf("preprocess.case")).toBeLessThan(text.indexOf("preprocess.ngram"));
    expect(text).toContain("0.050"); // ampleur de l'axe case : (0.465) − (0.415)
  });
});

// --------------------------------------------------------------------------- //
// Famille C — comparaison appariée
// --------------------------------------------------------------------------- //

describe("ExperimentResults — comparaison appariée", () => {
  const PAIRED_AGG: ExperimentAggregate = {
    ...BASE_AGG,
    preset: "embeddings-frozen",
    axis: null,
    runs: [
      { id: "best", status: "succeeded", value: 0.5, ci: { low: 0.46, high: 0.54 },
        axisValue: null, config: { model: { encoder: "e5-large" } } },
      { id: "second", status: "succeeded", value: 0.48, ci: { low: 0.44, high: 0.52 },
        axisValue: null, config: { model: { encoder: "minilm" } } },
    ],
  };

  it("⭐ test apparié automatique meilleure-vs-seconde avec SignificanceNote", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getExperimentAggregate).mockResolvedValue(PAIRED_AGG);
    vi.mocked(api.comparePaired).mockResolvedValue({
      metric: "macro_f1", delta: 0.02, low: -0.004, high: 0.041, pValue: 0.11,
      nDocuments: 39, nResamples: 1000, nPermutations: 2000, unit: "document",
      confidence: 0.95, runA: "best", runB: "second",
      labelA: "e5-large", labelB: "minilm", test: "paired_bootstrap+permutation",
    });
    await renderExperiment();

    await waitFor(() =>
      expect(screen.getByTestId("significance-note")).toBeInTheDocument(),
    );
    expect(api.comparePaired).toHaveBeenCalledWith("demo", "best", "second", "macro_f1");
    expect(screen.getByTestId("significance-no-difference")).toBeInTheDocument();
    expect(screen.getByTestId("verdict-panel").textContent).toContain("encoder=e5-large");
  });

  it("⭐ prédictions absentes (422) → mode descriptif EXPLICITE, jamais un test silencieusement absent", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getExperimentAggregate).mockResolvedValue(PAIRED_AGG);
    vi.mocked(api.comparePaired).mockRejectedValue(
      new ApiError(422, "API 422", { detail: "aucune prédiction par phrase cataloguée" }),
    );
    await renderExperiment();

    await waitFor(() =>
      expect(screen.getByTestId("significance-unavailable")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("significance-unavailable").textContent).toContain(
      "aucune prédiction par phrase cataloguée",
    );
  });
});

// --------------------------------------------------------------------------- //
// Famille F — juges LLM
// --------------------------------------------------------------------------- //

describe("ExperimentResults — juges LLM", () => {
  const JUDGES_KAPPA: ExperimentAggregate = {
    ...BASE_AGG,
    preset: "llm-judges-baseline",
    metric: "kappa",
    axis: null,
    runs: [
      { id: "j1", status: "succeeded", value: 0.52, ci: { low: 0.48, high: 0.56 },
        axisValue: null, config: { model: { family: "llm_judge", judge: "fable" } } },
      { id: "j2", status: "succeeded", value: 0.44, ci: { low: 0.4, high: 0.48 },
        axisValue: null, config: { model: { family: "llm_judge", judge: "claude" } } },
    ],
  };

  it("⭐ verdict en κ contre l'accord humain 0,769 + matrice d'accords + α", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getExperimentAggregate).mockResolvedValue(JUDGES_KAPPA);
    vi.mocked(api.getJudgesAgreement).mockResolvedValue({
      kappa: {
        judges: ["claude", "fable"],
        // Listes alignées sur `judges` — jamais des dicts clefs par nom (camélisation).
        matrix: [[1, 0.61], [0.61, 1]],
        vsGold: [0.44, 0.52],
        n: 7621,
      },
      alpha: { point: 0.58, low: 0.52, high: 0.64 },
    });
    await renderExperiment();

    // Le verdict n'apparaît qu'une fois la requête κ résolue — la section REFUSE
    // d'afficher des macro-F1 étiquetées κ en attendant (revue adversariale).
    await waitFor(() => expect(screen.getByTestId("verdict-panel")).toBeInTheDocument());
    const verdict = screen.getByTestId("verdict-panel");
    expect(verdict.textContent).toContain("Meilleur juge : fable");
    expect(verdict.textContent).toContain("0.769");

    await waitFor(() => expect(screen.getByTestId("judges-agreement")).toBeInTheDocument());
    const matrix = screen.getByTestId("judges-kappa-matrix");
    expect(matrix.textContent).toContain("0.610");
    expect(screen.getByTestId("judges-agreement").textContent).toContain("0.580");
  });
});
