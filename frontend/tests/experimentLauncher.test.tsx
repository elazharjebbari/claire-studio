/**
 * « Nouvelle expérience » — le maillon entre un dataset construit et un run lancé,
 * absent avant cet audit UX (l'onglet Expériences ne faisait que lister des runs déjà
 * créés à la main via curl/CLI). Couvre le flux réel : créer → estimer → lancer, dans
 * les deux modes (guidé via preset, expert via JSON).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError } from "@/lib/api/client";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("@/features/lab/api", () => ({
  listDatasets: vi.fn(),
  listPresets: vi.fn(),
  createExperiment: vi.fn(),
  estimateExperiment: vi.fn(),
  launchExperiment: vi.fn(),
}));

const DATASETS = [
  {
    id: "ds-1", label: "audit-reel", maturity: "complete", aggregation: "consensus",
    status: "ready", fingerprint: "abc123def456", nDocuments: 6, nSentences: 862,
    nAnnotations: 9, createdAt: "2026-08-11T10:00:00Z",
  },
];

const CATALOG = {
  presets: [
    {
      id: "baseline-fast", label: "Baselines rapides", why: "sans plancher, rien n'est interprétable",
      durationHint: "~3 min CPU",
      config: { task: "T1_primary", model: { family: "tfidf_linear" } },
    },
    {
      id: "legal-bert-finetune", label: "Legal-BERT fine-tuning", durationHint: "~45 min GPU",
      config: { task: "T1_primary", model: { family: "transformer_finetune", checkpoint: "nlpaueb/legal-bert-base-uncased" } },
    },
  ],
  recommendedOrder: ["baseline-fast", "legal-bert-finetune"],
};

async function setup() {
  const api = await import("@/features/lab/api");
  vi.mocked(api.listDatasets).mockResolvedValue(DATASETS as never);
  vi.mocked(api.listPresets).mockResolvedValue(CATALOG as never);
  const { ExperimentLauncher } = await import("@/features/lab/ExperimentLauncher");
  const onLaunched = vi.fn();
  const user = userEvent.setup();
  render(<ExperimentLauncher slug="demo" onLaunched={onLaunched} />);
  await user.click(screen.getByTestId("experiment-launcher-open"));
  await screen.findByTestId("experiment-launcher");
  return { api, onLaunched, user };
}

describe("ExperimentLauncher — mode guidé", () => {
  it("crée l'expérience avec la config du preset choisi et le dataset sélectionné", async () => {
    const { api, user } = await setup();
    vi.mocked(api.createExperiment).mockResolvedValue({
      id: "exp-1", name: "Legal-BERT fine-tuning", task: "T1_primary", dataset: "ds-1",
      datasetFingerprint: "abc123def456", config: {}, createdAt: "2026-08-11T10:00:00Z",
    } as never);
    vi.mocked(api.estimateExperiment).mockResolvedValue({
      nRuns: 1, estimatedMinutes: 45, requiresGpu: true,
    } as never);

    await screen.findByTestId("preset-baseline-fast");
    await user.click(screen.getByTestId("preset-legal-bert-finetune"));
    await user.click(screen.getByTestId("experiment-create"));

    await waitFor(() => expect(api.createExperiment).toHaveBeenCalledTimes(1));
    const call = vi.mocked(api.createExperiment).mock.calls[0]!;
    const [, payload] = call;
    expect(payload.dataset).toBe("ds-1");
    expect((payload.config as Record<string, unknown>).datasetId).toBe("ds-1");
    expect(
      ((payload.config as any).model as Record<string, unknown>).checkpoint,
    ).toBe("nlpaueb/legal-bert-base-uncased");

    const estimate = await screen.findByTestId("experiment-estimate");
    expect(estimate.textContent).toContain("45 min");
    expect(estimate.textContent).toMatch(/GPU requis/);
  });

  it("⭐ lancer déclenche le run et prévient le parent (RunList doit se rafraîchir)", async () => {
    const { api, onLaunched, user } = await setup();
    vi.mocked(api.createExperiment).mockResolvedValue({
      id: "exp-1", name: "x", task: "T1_primary", dataset: "ds-1",
      datasetFingerprint: "abc", config: {}, createdAt: "",
    } as never);
    vi.mocked(api.estimateExperiment).mockResolvedValue({
      nRuns: 1, estimatedMinutes: 3, requiresGpu: false,
    } as never);
    vi.mocked(api.launchExperiment).mockResolvedValue({ runIds: ["run-1"], duplicates: [] } as never);

    await user.click(await screen.findByTestId("preset-baseline-fast"));
    await user.click(screen.getByTestId("experiment-create"));
    await user.click(await screen.findByTestId("experiment-launch"));

    await waitFor(() => expect(onLaunched).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("experiment-launched")).toBeInTheDocument();
  });

  it("un lancement en doublon (409) affiche le motif sans planter", async () => {
    const { api, user } = await setup();
    vi.mocked(api.createExperiment).mockResolvedValue({
      id: "exp-1", name: "x", task: "T1_primary", dataset: "ds-1",
      datasetFingerprint: "abc", config: {}, createdAt: "",
    } as never);
    vi.mocked(api.estimateExperiment).mockResolvedValue({
      nRuns: 1, estimatedMinutes: 3, requiresGpu: false,
    } as never);
    vi.mocked(api.launchExperiment).mockResolvedValue({ runIds: [], duplicates: ["run-old"] } as never);

    await user.click(await screen.findByTestId("preset-baseline-fast"));
    await user.click(screen.getByTestId("experiment-create"));
    await user.click(await screen.findByTestId("experiment-launch"));

    expect(await screen.findByTestId("experiment-error")).toHaveTextContent(/déjà été exécutés/);
  });

  it("une config refusée par le serveur affiche le chemin JSON-pointer fautif", async () => {
    const { api, user } = await setup();
    vi.mocked(api.createExperiment).mockRejectedValue(
      new ApiError(400, "API 400", { code: "config_invalid", detail: "doit valoir 1", path: "/version" }),
    );

    await user.click(await screen.findByTestId("preset-baseline-fast"));
    await user.click(screen.getByTestId("experiment-create"));

    expect(await screen.findByTestId("experiment-error")).toHaveTextContent("/version : doit valoir 1");
  });
});

describe("ExperimentLauncher — mode expert", () => {
  it("un JSON invalide est refusé côté client, avant tout appel réseau", async () => {
    const { api, user } = await setup();
    await user.click(screen.getByTestId("experiment-mode-expert"));
    const textarea = screen.getByTestId("experiment-config-json");
    fireEvent.change(textarea, { target: { value: "{ ceci n'est pas du json" } });
    await user.click(screen.getByTestId("experiment-create"));

    expect(await screen.findByTestId("experiment-error")).toHaveTextContent(/JSON invalide/);
    expect(api.createExperiment).not.toHaveBeenCalled();
  });

  it("part de la config déjà générée par le mode guidé — pas de duplication de logique", async () => {
    const { user } = await setup();
    await user.click(await screen.findByTestId("preset-baseline-fast"));
    await user.click(screen.getByTestId("experiment-mode-expert"));
    const textarea = screen.getByTestId("experiment-config-json") as HTMLTextAreaElement;
    expect(textarea.value).toContain("tfidf_linear");
    expect(textarea.value).toContain("ds-1");
  });
});
