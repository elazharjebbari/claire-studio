import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisLab } from "@/features/analysis/AnalysisLab";
import * as hooks from "@/features/analysis/hooks";
import type { AnalysisReport, AnalysisResult } from "@/features/analysis/types";

vi.mock("@/features/analysis/hooks", () => ({
  useAnalysisSnapshots: vi.fn(),
  useAnalysisPresets: vi.fn(),
  useCreateAnalysisPreset: vi.fn(),
  useCreateAnalysis: vi.fn(),
  useAnalysisReports: vi.fn(),
  useAnalysisReport: vi.fn(),
  useAnalysisRun: vi.fn(),
  useAnalysisArtifact: vi.fn(),
  useCreateAnalysisReport: vi.fn(),
  useReportComparison: vi.fn(),
  useArchiveReport: vi.fn(),
  useRenderReport: vi.fn(),
  useDownloadArtifact: vi.fn(),
}));

const result: AnalysisResult = {
  overview: {
    documents: 1,
    humanActors: 1,
    llmActors: 0,
    annotations: 1,
    draftAnnotations: 1,
    publishedAnnotations: 0,
    statusDistribution: { draft: 1 },
    eligibleSentences: 5,
    coveredSentences: 3,
    coverageRate: 0.6,
    goldDecisions: 0,
  },
  actorProfiles: {
    actors: [
      {
        actorKey: "human:1",
        pseudonym: "A-12345678",
        assignedDocuments: 1,
        annotations: 1,
        draftAnnotations: 1,
        publishedAnnotations: 0,
        clauses: 2,
        validatedClauses: 1,
        eligibleSentences: 5,
        coveredSentences: 3,
        coverageRate: 0.6,
        validationRate: 0.5,
        certaintyDistribution: { "2": 2 },
        themeDistribution: [{ theme: "META", count: 2 }],
      },
    ],
  },
  quality: {
    clauses: 2,
    multilabelClauses: 1,
    multilabelRate: 0.5,
    validatedClauses: 1,
    validationRate: 0.5,
    certaintyDistribution: { "2": 1, missing: 1 },
    warnings: [],
  },
  pairwiseAgreement: {
    meanKappa: 0.4,
    caseCount: 2,
    supportedPairCount: 1,
    warnings: [],
    pairs: [
      {
        documentId: 1,
        mode: "human_llm",
        actorA: "A-12345678",
        actorB: "codex:v1",
        support: 20,
        rawAgreement: 0.7,
        cohenKappa: 0.4,
        jaccardMultilabel: 0.6,
        boundaryF1: 0.8,
      },
    ],
  },
  goldAnalysis: {
    goldUnits: 5,
    decidedUnits: 3,
    readinessRate: 0.6,
    riskDistribution: { high: 2 },
    actorScores: [],
  },
  taxonomy: {
    primaryThemes: [{ theme: "META", count: 2 }],
    secondaryThemes: [],
    rareThemes: ["META"],
    cooccurrences: [],
  },
};

// Résultat enrichi (chantier Lab) : un run PLUS RÉCENT porte aussi les 8 nouvelles
// métriques. Un fixture séparé — le fixture `result` ci-dessus reste tel quel pour
// prouver la non-régression sur un rapport produit AVANT cet enrichissement.
const enrichedResult: AnalysisResult = {
  ...result,
  alphaMasi: {
    alphaMasi: 0.635,
    alphaNominal: 0.701,
    multiLabelCost: 0.066,
    band: "below_threshold",
    thresholds: { acceptable: 0.667, reliable: 0.8 },
    units: 1911,
    perTheme: [],
    warnings: [],
  },
  boundaryAgreement: {
    perDocument: [
      { documentId: 1, nSentences: 139, annotators: 2, segmentsPerAnnotator: [55, 39], jaccard: 0.516, windowDiff: 0.2, pk: 0.2 },
    ],
    meanJaccard: 0.516,
    documentsCompared: 1,
    definition: "segment = plage maximale de phrases au même ensemble de thèmes",
    replaces: "boundary_kappa (artefact : vaut 1.0 car chaque phrase porte une ancre)",
    warnings: [],
  },
  humanLlmMatrix: {
    actors: [{ key: "human:1", kind: "human" }, { key: "llm:fable", kind: "llm" }],
    cells: [{ a: "human:1", b: "llm:fable", agreement: 0.53, n: 500, kind: "human_llm" }],
    humanMean: null,
    llmMean: null,
    crossMean: 0.53,
    humanAdvantage: null,
    warnings: [],
  },
  labelDistribution: {
    themes: [{ code: "META", primary: 2, secondary: 0, total: 2, share: 1 }],
    nThemes: 1,
    totalPrimary: 2,
    normalizedEntropy: 0,
    rareThemes: ["META"],
    rareThreshold: 50,
    imbalanceRatio: null,
    warnings: [],
  },
  cooccurrence: {
    pairs: [
      { themes: ["LICENSE_IP", "TERMINATION"], count: 13, unfair: 10, unfairRate: 0.77, lift: 7.4 },
    ],
    nPairs: 1,
    nCombinations: 1,
    nHapaxCombinations: 0,
    baseUnfairRate: 0.1,
    monoLabel: { count: 5, unfair: 1, rate: 0.2 },
    multiLabel: { count: 5, unfair: 1, rate: 0.2 },
    cardinalityLift: 1.09,
    warnings: [],
  },
  goldProgress: {
    sentences: 425,
    decided: 290,
    pctDecided: 0.68,
    byAutoLevel: { auto_1click: 222, auto: 68, manual: 135 },
    byAgreementClass: {},
    byRiskBand: {},
    arbitrationBacklog: [],
    backlogSize: 135,
    documents: 1,
    warnings: [],
  },
  campaignReadiness: {
    documentsTotal: 50,
    documentsAnnotated: 36,
    documentsMultiAnnotatedSubmitted: 4,
    documentsMultiAnnotatedComplete: 7,
    documentsTripleAnnotated: 3,
    documentsWithGold: 0,
    completeButNotSubmitted: [
      { documentId: 1, actorKey: "human:3", validated: 193, nSentences: 193 },
    ],
    targets: { multiAnnotated: 12, tripleAnnotated: 5, goldFinalized: 3 },
    blockers: [
      { code: "no_gold_finalized", message: "aucune résolution gold décidée", severity: "medium" },
    ],
  },
};

const report: AnalysisReport = {
  id: "report-1",
  snapshotId: "snapshot-1",
  runId: "run-1",
  title: "État du brouillon",
  description: "",
  visibility: "personal",
  status: "ready",
  summary: result.overview!,
  payload: result,
  createdAt: "2026-07-22T09:00:00Z",
};

describe("AnalysisLab", () => {
  const createAnalysis = vi.fn();
  const createReport = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hooks.useAnalysisSnapshots).mockReturnValue({
      data: { count: 0, results: [] },
    } as never);
    vi.mocked(hooks.useAnalysisPresets).mockReturnValue({
      data: { count: 0, results: [] },
    } as never);
    vi.mocked(hooks.useCreateAnalysisPreset).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(hooks.useAnalysisReports).mockReturnValue({
      data: { count: 0, results: [] },
    } as never);
    vi.mocked(hooks.useAnalysisReport).mockReturnValue({ data: undefined } as never);
    vi.mocked(hooks.useAnalysisRun).mockReturnValue({ data: undefined } as never);
    vi.mocked(hooks.useAnalysisArtifact).mockReturnValue({ data: undefined } as never);
    vi.mocked(hooks.useReportComparison).mockReturnValue({ data: undefined } as never);
    vi.mocked(hooks.useCreateAnalysis).mockReturnValue({
      mutateAsync: createAnalysis,
      isPending: false,
    } as never);
    vi.mocked(hooks.useCreateAnalysisReport).mockReturnValue({
      mutateAsync: createReport,
      isPending: false,
    } as never);
    vi.mocked(hooks.useArchiveReport).mockReturnValue({ mutate: vi.fn() } as never);
    vi.mocked(hooks.useRenderReport).mockReturnValue({ mutateAsync: vi.fn() } as never);
    vi.mocked(hooks.useDownloadArtifact).mockReturnValue({ mutate: vi.fn() } as never);
  });

  it("analyse un brouillon puis propose de conserver le rapport", async () => {
    createAnalysis.mockResolvedValue({
      snapshot: { id: "snapshot-1" },
      run: { id: "run-1", status: "succeeded", result },
    });
    render(<AnalysisLab slug="demo" />);

    expect(screen.getByText(/annotations non publiées/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /analyser l’état actuel/i }));

    await waitFor(() => expect(screen.getByTestId("analysis-kpis")).toBeInTheDocument());
    expect(screen.getByText("1 brouillon(s)")).toBeInTheDocument();
    expect(screen.getByText("A-12345678")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /conserver comme rapport/i })).toBeInTheDocument();
  });

  it("ouvre instantanément un ancien rapport depuis la chronologie", async () => {
    vi.mocked(hooks.useAnalysisReports).mockReturnValue({
      data: { count: 1, results: [report] },
    } as never);
    vi.mocked(hooks.useAnalysisReport).mockImplementation(
      (_slug, id) => ({ data: id ? report : undefined }) as never,
    );
    vi.mocked(hooks.useReportComparison).mockImplementation(
      (_slug, id) =>
        ({
          data: id ? { current: {}, previous: {}, delta: { coverageRate: 0.2 } } : undefined,
        }) as never,
    );
    render(<AnalysisLab slug="demo" />);

    await userEvent.click(screen.getByRole("button", { name: /état du brouillon/i }));
    await waitFor(() => expect(screen.getByTestId("analysis-kpis")).toBeInTheDocument());
    expect(screen.getAllByText("60 %").length).toBeGreaterThan(0);
    expect(screen.getByText("+20 pt")).toBeInTheDocument();
    expect(screen.getByText(/rapport historique/i)).toBeInTheDocument();
  });

  it("permet de parcourir un historique paginé", async () => {
    vi.mocked(hooks.useAnalysisReports).mockImplementation(
      (_slug, page = 1) =>
        ({
          data: {
            count: 26,
            previous: page > 1 ? "previous" : null,
            next: page === 1 ? "next" : null,
            results: [report],
          },
        }) as never,
    );
    render(<AnalysisLab slug="demo" />);

    expect(screen.getByText("26 rapport(s) conservé(s)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Suivants" }));

    await waitFor(() => expect(screen.getByText("Page 2")).toBeInTheDocument());
    expect(hooks.useAnalysisReports).toHaveBeenLastCalledWith("demo", 2);
  });

  it("parcourt les modes qualité, accords, Gold et taxonomie", async () => {
    vi.mocked(hooks.useAnalysisReports).mockReturnValue({
      data: { count: 1, results: [report] },
    } as never);
    vi.mocked(hooks.useAnalysisReport).mockImplementation(
      (_slug, id) => ({ data: id ? report : undefined }) as never,
    );
    render(<AnalysisLab slug="demo" />);
    await userEvent.click(screen.getByRole("button", { name: /état du brouillon/i }));

    await userEvent.click(screen.getByRole("tab", { name: "Qualité" }));
    expect(screen.getByText("Qualité des observations")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Accords" }));
    expect(screen.getByText("2 désaccord(s), support toujours visible.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Gold" }));
    expect(screen.getByText("Readiness et proximité Gold")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Taxonomie" }));
    expect(screen.getByText("META · 2")).toBeInTheDocument();
  });

  it("prépare puis propose le téléchargement du PDF historique", async () => {
    const renderPdf = vi.fn().mockResolvedValue({ id: "artifact-1" });
    vi.mocked(hooks.useAnalysisReports).mockReturnValue({
      data: { count: 1, results: [report] },
    } as never);
    vi.mocked(hooks.useAnalysisReport).mockImplementation(
      (_slug, id) => ({ data: id ? report : undefined }) as never,
    );
    vi.mocked(hooks.useRenderReport).mockReturnValue({ mutateAsync: renderPdf } as never);
    vi.mocked(hooks.useAnalysisArtifact).mockImplementation(
      (_slug, id) =>
        ({
          data: id
            ? { id, reportId: report.id, status: "ready", checksum: "abc", sizeBytes: 2 }
            : undefined,
        }) as never,
    );
    render(<AnalysisLab slug="demo" />);
    await userEvent.click(screen.getByRole("button", { name: /état du brouillon/i }));
    await userEvent.click(screen.getByRole("button", { name: "Préparer le PDF" }));

    await waitFor(() => expect(renderPdf).toHaveBeenCalledWith(report.id));
    expect(screen.getByRole("button", { name: "Télécharger le PDF" })).toBeInTheDocument();
  });

  // ------------------------------------------------------------------------- //
  // Enrichissement Lab : les 8 nouvelles métriques, additives et sans casse.
  // ------------------------------------------------------------------------- //

  it("un rapport ANCIEN (sans métriques Lab) n'affiche ni le bandeau ni l'onglet Fiabilité", async () => {
    vi.mocked(hooks.useAnalysisReports).mockReturnValue({
      data: { count: 1, results: [report] },
    } as never);
    vi.mocked(hooks.useAnalysisReport).mockImplementation(
      (_slug, id) => ({ data: id ? report : undefined }) as never,
    );
    render(<AnalysisLab slug="demo" />);
    await userEvent.click(screen.getByRole("button", { name: /état du brouillon/i }));

    await waitFor(() => expect(screen.getByTestId("analysis-kpis")).toBeInTheDocument());
    expect(screen.queryByTestId("readiness-panel")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Fiabilité" }));
    expect(screen.getByText(/produit avant l'enrichissement Lab/)).toBeInTheDocument();
  });

  it("un rapport ENRICHI affiche le bandeau « prêt pour la science » en vue d’ensemble", async () => {
    const enrichedReport: AnalysisReport = { ...report, payload: enrichedResult };
    vi.mocked(hooks.useAnalysisReports).mockReturnValue({
      data: { count: 1, results: [enrichedReport] },
    } as never);
    vi.mocked(hooks.useAnalysisReport).mockImplementation(
      (_slug, id) => ({ data: id ? enrichedReport : undefined }) as never,
    );
    render(<AnalysisLab slug="demo" />);
    await userEvent.click(screen.getByRole("button", { name: /état du brouillon/i }));

    await waitFor(() => expect(screen.getByTestId("readiness-panel")).toBeInTheDocument());
    // Le travail récupérable (annotations finies non soumises) est mis en avant.
    expect(screen.getByTestId("readiness-recoverable")).toBeInTheDocument();
  });

  it("l'onglet Fiabilité rend les figures F1/F3/F4 depuis les métriques du Lab", async () => {
    const enrichedReport: AnalysisReport = { ...report, payload: enrichedResult };
    vi.mocked(hooks.useAnalysisReports).mockReturnValue({
      data: { count: 1, results: [enrichedReport] },
    } as never);
    vi.mocked(hooks.useAnalysisReport).mockImplementation(
      (_slug, id) => ({ data: id ? enrichedReport : undefined }) as never,
    );
    render(<AnalysisLab slug="demo" />);
    await userEvent.click(screen.getByRole("button", { name: /état du brouillon/i }));

    await userEvent.click(screen.getByRole("tab", { name: "Fiabilité" }));
    expect(screen.getByTestId("figure-alpha")).toBeInTheDocument();
    expect(screen.getByTestId("figure-boundary")).toBeInTheDocument();
    expect(screen.getByTestId("figure-matrix")).toBeInTheDocument();
    // Le κ de la métrique historique `pairwiseAgreement` sert de ligne de référence
    // à la figure des frontières : les deux métriques doivent rester cohérentes.
    expect(screen.getByTestId("figure-boundary").textContent).toContain("40 %");
  });

  it("la taxonomie enrichie ajoute la longue traîne et la co-occurrence (F2, F12)", async () => {
    const enrichedReport: AnalysisReport = { ...report, payload: enrichedResult };
    vi.mocked(hooks.useAnalysisReports).mockReturnValue({
      data: { count: 1, results: [enrichedReport] },
    } as never);
    vi.mocked(hooks.useAnalysisReport).mockImplementation(
      (_slug, id) => ({ data: id ? enrichedReport : undefined }) as never,
    );
    render(<AnalysisLab slug="demo" />);
    await userEvent.click(screen.getByRole("button", { name: /état du brouillon/i }));

    await userEvent.click(screen.getByRole("tab", { name: "Taxonomie" }));
    expect(screen.getByTestId("figure-longtail")).toBeInTheDocument();
    expect(screen.getByTestId("figure-cooccurrence")).toBeInTheDocument();
    expect(screen.getByTestId("figure-cooccurrence").textContent).toContain("LICENSE_IP");
  });

  it("le Gold enrichi ajoute la cascade de résolution (F11)", async () => {
    const enrichedReport: AnalysisReport = { ...report, payload: enrichedResult };
    vi.mocked(hooks.useAnalysisReports).mockReturnValue({
      data: { count: 1, results: [enrichedReport] },
    } as never);
    vi.mocked(hooks.useAnalysisReport).mockImplementation(
      (_slug, id) => ({ data: id ? enrichedReport : undefined }) as never,
    );
    render(<AnalysisLab slug="demo" />);
    await userEvent.click(screen.getByRole("button", { name: /état du brouillon/i }));

    await userEvent.click(screen.getByRole("tab", { name: "Gold" }));
    expect(screen.getByText("Readiness et proximité Gold")).toBeInTheDocument();
    expect(screen.getByTestId("figure-gold-cascade")).toBeInTheDocument();
  });
});
