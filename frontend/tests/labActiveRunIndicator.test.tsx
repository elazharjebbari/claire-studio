/**
 * Indicateur de run actif — visible depuis les 3 onglets du Lab (audit UI/UX, 15 août
 * 2026) : avant ce composant, un run démarré puis oublié ne signalait jamais sa fin
 * hors de l'onglet Expériences resté ouvert.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
  listRuns: vi.fn(),
}));

describe("ActiveRunIndicator", () => {
  it("rien à afficher quand aucun run n'est actif — pas de badge vide trompeur", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([
      { id: "1", experimentName: "fini", task: "T1_primary", status: "succeeded",
        progress: 100, phase: "", macroF1: 0.5, errorCode: "", createdAt: "", completedAt: "" },
    ] as never);
    const { ActiveRunIndicator } = await import("@/features/lab/ActiveRunIndicator");
    render(<ActiveRunIndicator slug="demo" />, { wrapper: wrapper() });

    await waitFor(() => expect(api.listRuns).toHaveBeenCalled());
    expect(screen.queryByTestId("active-run-indicator")).not.toBeInTheDocument();
  });

  it("⭐ signale un run actif et mène directement à son détail", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([
      { id: "2", experimentName: "legal-bert en cours", task: "T1_primary", status: "running",
        progress: 30, phase: "pli 2/5", macroF1: null, errorCode: "", createdAt: "",
        completedAt: null, startedAt: "2026-08-15T09:00:00Z" },
    ] as never);
    const { ActiveRunIndicator } = await import("@/features/lab/ActiveRunIndicator");
    render(<ActiveRunIndicator slug="demo" />, { wrapper: wrapper() });

    const badge = await screen.findByTestId("active-run-indicator");
    expect(badge.textContent).toContain("1 run actif");
    expect(badge).toHaveAttribute("href", "/projects/demo/lab/runs/2");
  });

  it("plusieurs runs actifs (cas rare, worker séquentiel mais reprise possible) : compte au pluriel", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([
      { id: "3", experimentName: "a", task: "T1_primary", status: "running", progress: 10,
        phase: "", macroF1: null, errorCode: "", createdAt: "", completedAt: null },
      { id: "4", experimentName: "b", task: "T1_primary", status: "waiting", progress: 0,
        phase: "", macroF1: null, errorCode: "", createdAt: "", completedAt: null },
    ] as never);
    const { ActiveRunIndicator } = await import("@/features/lab/ActiveRunIndicator");
    render(<ActiveRunIndicator slug="demo" />, { wrapper: wrapper() });

    const badge = await screen.findByTestId("active-run-indicator");
    expect(badge.textContent).toContain("2 runs actifs");
  });

  it("liste vide → rien à afficher", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([] as never);
    const { ActiveRunIndicator } = await import("@/features/lab/ActiveRunIndicator");
    render(<ActiveRunIndicator slug="demo" />, { wrapper: wrapper() });

    await waitFor(() => expect(api.listRuns).toHaveBeenCalled());
    expect(screen.queryByTestId("active-run-indicator")).not.toBeInTheDocument();
  });
});
