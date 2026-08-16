/**
 * Onglet Programmes (`ProgramsPanel`) — les blocs ciblés au service des publications
 * (docs/pactiva-lab/05_BLOCS_ET_PROGRAMMES.md) : progression dérivée des runs réels,
 * action juste par item (lancer / résultats).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  getPrograms: vi.fn(),
  listDatasets: vi.fn(),
  listPresets: vi.fn(),
}));

const DATASETS = [
  { id: "ds-1", label: "campagne", maturity: "complete", aggregation: "consensus",
    status: "ready", fingerprint: "abc123def456", nDocuments: 39, nSentences: 7621,
    nAnnotations: 50, createdAt: "" },
  { id: "ds-2", label: "essai", maturity: "any", aggregation: "consensus",
    status: "ready", fingerprint: "fed654cba321", nDocuments: 5, nSentences: 50,
    nAnnotations: 5, createdAt: "" },
];

const PROGRAMS = {
  programs: [
    {
      id: "papier-long", label: "Papier long", paper: "long",
      goal: "Le classifieur et les figures F5-F9.",
      items: [
        { preset: "baseline-fast", role: "Plancher TF-IDF" },
        { preset: "legal-bert-finetune", role: "Résultat principal T1" },
      ],
    },
  ],
  dataset: "ds-1",
  presetStatus: {
    "baseline-fast": { nRuns: 1, byStatus: { succeeded: 1 }, lastRunAt: "2026-08-15",
      experimentId: "exp-bf", validated: true },
  },
};

const CATALOG = {
  presets: [
    { id: "baseline-fast", label: "Baselines rapides", config: {} },
    { id: "legal-bert-finetune", label: "Legal-BERT fine-tuning", config: {} },
  ],
  recommendedOrder: [],
  themes: [],
};

async function setup() {
  const api = await import("@/features/lab/api");
  vi.mocked(api.listDatasets).mockResolvedValue(DATASETS as never);
  vi.mocked(api.getPrograms).mockResolvedValue(PROGRAMS as never);
  vi.mocked(api.listPresets).mockResolvedValue(CATALOG as never);
  const { ProgramsPanel } = await import("@/features/lab/ProgramsPanel");
  const onLaunchPreset = vi.fn();
  render(<ProgramsPanel slug="demo" onLaunchPreset={onLaunchPreset} />, {
    wrapper: wrapper(),
  });
  await waitFor(() => expect(screen.getByTestId("programs-panel")).toBeInTheDocument());
  return { api, onLaunchPreset };
}

describe("ProgramsPanel", () => {
  it("⭐ affiche le programme avec sa progression dérivée des runs (1/2 validés)", async () => {
    await setup();
    const card = screen.getByTestId("program-papier-long");
    expect(card.textContent).toContain("Papier long");
    expect(card.textContent).toContain("papier long"); // badge
    expect(screen.getByTestId("program-progress-papier-long").textContent).toBe("1/2 validés");
  });

  it("chaque item porte son rôle, son statut, et le libellé HUMAIN du preset", async () => {
    await setup();
    const done = screen.getByTestId("program-item-papier-long-baseline-fast");
    expect(done.textContent).toContain("Baselines rapides");
    expect(done.textContent).toContain("Plancher TF-IDF");
    expect(done.textContent).toContain("validé");
    const todo = screen.getByTestId("program-item-papier-long-legal-bert-finetune");
    expect(todo.textContent).toContain("jamais lancé");
  });

  it("⭐ l'action juste par item : Résultats si une expérience existe, Lancer sinon", async () => {
    const { onLaunchPreset } = await setup();
    expect(
      screen.getByTestId("program-results-papier-long-baseline-fast"),
    ).toHaveAttribute("href", "/projects/demo/lab/experiments/exp-bf");
    expect(
      screen.queryByTestId("program-results-papier-long-legal-bert-finetune"),
    ).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByTestId("program-launch-papier-long-legal-bert-finetune"));
    expect(onLaunchPreset).toHaveBeenCalledWith("legal-bert-finetune");
  });

  it("⭐ changer de dataset recharge l'avancement pour CE dataset (jamais toutes-données-confondues)", async () => {
    const { api } = await setup();
    await waitFor(() => expect(api.getPrograms).toHaveBeenCalledWith("demo", "ds-1"));

    const user = userEvent.setup();
    await user.selectOptions(screen.getByTestId("programs-dataset-select"), "ds-2");
    await waitFor(() => expect(api.getPrograms).toHaveBeenCalledWith("demo", "ds-2"));
  });
});
