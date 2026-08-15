/**
 * Regroupement des runs par expérience (lot L6, dossier 04 §5) : un sweep se lit par
 * sa ligne d'agrégat et sa vue d'ensemble, pas par 48 lignes brutes.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { groupRuns } from "@/features/lab/runGroups";
import type { RunSummary } from "@/features/lab/types";

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

function makeRun(overrides: Partial<RunSummary>): RunSummary {
  return {
    id: "r", experiment: "e", experimentName: "exp", preset: "", task: "T1_primary",
    status: "succeeded", progress: 100, phase: "", macroF1: 0.5, errorCode: "",
    createdAt: "", completedAt: "", computeTarget: "local", computeSite: null,
    startedAt: null, heartbeatAt: null, cancelRequested: false,
    ...overrides,
  };
}

describe("groupRuns (pur)", () => {
  it("regroupe par expérience en gardant l'ordre d'apparition, avec agrégats", () => {
    const runs = [
      makeRun({ id: "a1", experiment: "expA", macroF1: 0.4 }),
      makeRun({ id: "b1", experiment: "expB", macroF1: 0.6 }),
      makeRun({ id: "a2", experiment: "expA", macroF1: 0.45, status: "running" }),
      makeRun({ id: "a3", experiment: "expA", macroF1: null, status: "failed" }),
    ];
    const groups = groupRuns(runs);
    expect(groups.map((g) => g.experimentId)).toEqual(["expA", "expB"]);
    const a = groups[0]!;
    expect(a.runs.map((r) => r.id)).toEqual(["a1", "a2", "a3"]);
    expect(a.bestMacroF1).toBe(0.45);
    expect(a.activeCount).toBe(1);
    expect(a.failedCount).toBe(1);
  });

  it("un run sans experiment (fixture ancienne) forme son propre groupe — jamais fusionné à tort", () => {
    const runs = [
      makeRun({ id: "x", experiment: "" }),
      makeRun({ id: "y", experiment: "" }),
    ];
    expect(groupRuns(runs)).toHaveLength(2);
  });
});

describe("RunList — regroupement des sweeps", () => {
  const SWEEP = [
    makeRun({ id: "s1", experiment: "sweep-1", experimentName: "criblage", macroF1: 0.44 }),
    makeRun({ id: "s2", experiment: "sweep-1", experimentName: "criblage", macroF1: 0.47 }),
    makeRun({ id: "s3", experiment: "sweep-1", experimentName: "criblage", macroF1: 0.41 }),
    makeRun({ id: "solo", experiment: "exp-solo", experimentName: "unique", macroF1: 0.5 }),
  ];

  it("⭐ un sweep = UNE ligne d'agrégat (repliée par défaut) + lien vue d'ensemble ; un run isolé = ligne simple", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValue(SWEEP as never);
    const { RunList } = await import("@/features/lab/RunList");
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    const header = await screen.findByTestId("run-group-sweep-1");
    expect(header.textContent).toContain("3 runs");
    expect(header.textContent).toContain("0.470"); // meilleur
    expect(screen.getByTestId("run-group-link-sweep-1")).toHaveAttribute(
      "href", "/projects/demo/lab/experiments/sweep-1",
    );
    // Replié : les lignes du sweep n'apparaissent pas ; le run isolé si.
    expect(screen.queryByTestId("run-s1")).not.toBeInTheDocument();
    expect(screen.getByTestId("run-solo")).toBeInTheDocument();
  });

  it("⭐ déplier montre les runs individuels, replier les masque", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValue(SWEEP as never);
    const { RunList } = await import("@/features/lab/RunList");
    const user = userEvent.setup();
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    const toggle = await screen.findByTestId("run-group-toggle-sweep-1");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("run-s1")).toBeInTheDocument();
    expect(screen.getByTestId("run-s2")).toBeInTheDocument();
    await user.click(toggle);
    expect(screen.queryByTestId("run-s1")).not.toBeInTheDocument();
  });

  it("la ligne d'agrégat signale les runs actifs et en échec", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValue([
      makeRun({ id: "s1", experiment: "sweep-2", status: "running", macroF1: null }),
      makeRun({ id: "s2", experiment: "sweep-2", status: "failed", macroF1: null }),
      makeRun({ id: "s3", experiment: "sweep-2", status: "succeeded", macroF1: 0.4 }),
    ] as never);
    const { RunList } = await import("@/features/lab/RunList");
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    const header = await screen.findByTestId("run-group-sweep-2");
    expect(header.textContent).toContain("1 actif(s)");
    expect(header.textContent).toContain("1 échec(s)");
    expect(header.textContent).toContain("1 terminé(s)");
  });
});
