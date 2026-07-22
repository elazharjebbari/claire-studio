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
});
