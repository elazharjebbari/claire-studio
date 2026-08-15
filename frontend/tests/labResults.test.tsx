/**
 * Figures de résultats du Lab (F6/F8/F9/F10) et écran de détail d'un run.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useApiErrorStore } from "@/store/apiErrors";

import {
  CalibrationFigure,
  ConfusionMatrixFigure,
  LabelScoreFigure,
  RunComparisonFigure,
} from "@/features/lab/charts";
import type { RunDetail } from "@/features/lab/types";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// `RunList`/`RunResults` utilisent `useQuery`/`useMutation` (react-query) — un client
// LOCAL par rendu, `retry: false` pour ne pas ralentir les tests sur un mock qui rejette.
// `queryCache`/`mutationCache.onError` reproduit EXACTEMENT le câblage de
// `app/providers.tsx` (`makeClient`) : sans lui, un test qui vérifie que la queue
// d'erreurs globale capte un échec testerait un mécanisme qui n'existe pas vraiment
// dans ce rendu isolé — un faux vert qui masquerait une régression du vrai câblage.
function wrapper() {
  const onError = (error: unknown) => useApiErrorStore.getState().push(error);
  const qc = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

// --------------------------------------------------------------------------- //
// F6 — score par étiquette
// --------------------------------------------------------------------------- //

describe("LabelScoreFigure", () => {
  it("liste chaque thème avec son F1 et son support", () => {
    render(
      <LabelScoreFigure
        rows={[
          { label: "PREAMBLE_SCOPE", f1: 0.82, support: 1163 },
          { label: "FEEDBACK", f1: 0.12, support: 31 },
        ]}
      />,
    );
    const table = screen.getByTestId("figure-label-scores-table");
    expect(table.textContent).toContain("PREAMBLE_SCOPE");
    expect(table.textContent).toContain("FEEDBACK");
  });

  it("état vide explicite", () => {
    render(<LabelScoreFigure rows={[]} />);
    expect(screen.getByTestId("figure-label-scores-empty")).toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------- //
// F8 — confusion
// --------------------------------------------------------------------------- //

describe("ConfusionMatrixFigure", () => {
  it("rend une cellule par couple (vérité, prédiction) non nul", () => {
    render(
      <ConfusionMatrixFigure
        matrix={{
          labels: ["A", "B"],
          matrix: [
            [8, 2],
            [1, 9],
          ],
        }}
      />,
    );
    const table = screen.getByTestId("figure-confusion-table");
    expect(table.querySelectorAll("tbody tr").length).toBe(4);
  });

  it("état vide quand aucune matrice n'est fournie", () => {
    render(<ConfusionMatrixFigure matrix={null} />);
    expect(screen.getByTestId("figure-confusion-empty")).toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------- //
// F9 — comparaison de runs
// --------------------------------------------------------------------------- //

describe("RunComparisonFigure", () => {
  it("affiche le plafond humain en légende ET en référence", () => {
    render(
      <RunComparisonFigure
        rows={[
          { runId: "1", label: "legal-bert", value: 0.68, ci: { low: 0.6, high: 0.74 } },
          { runId: "2", label: "tfidf", value: 0.55, ci: null },
        ]}
        humanCeiling={0.74}
      />,
    );
    const figure = screen.getByTestId("figure-run-comparison");
    expect(figure.textContent).toContain("0.740");
    expect(screen.getByTestId("figure-run-comparison-table").textContent).toContain("legal-bert");
  });

  it("aucun run comparable → message explicite", () => {
    render(<RunComparisonFigure rows={[]} />);
    expect(screen.getByTestId("figure-run-comparison-empty").textContent).toMatch(
      /au moins deux runs/i,
    );
  });
});

// --------------------------------------------------------------------------- //
// F10 — calibration
// --------------------------------------------------------------------------- //

describe("CalibrationFigure", () => {
  it("affiche l'ECE et une bulle par tranche", () => {
    render(
      <CalibrationFigure
        buckets={[
          { bin: 0, meanConfidence: 0.5, accuracy: 0.4, count: 20 },
          { bin: 9, meanConfidence: 0.95, accuracy: 0.6, count: 10 },
        ]}
        ece={0.18}
      />,
    );
    expect(screen.getByTestId("figure-calibration").textContent).toContain("0.180");
  });

  it("état vide quand aucune confiance n'est disponible", () => {
    render(<CalibrationFigure buckets={[]} />);
    expect(screen.getByTestId("figure-calibration-empty")).toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------- //
// Écran de résultats d'un run
// --------------------------------------------------------------------------- //

// Un seul mock pour tout le fichier : `vi.mock` est hissé en tête de module, deux
// déclarations pour le même chemin sont fragiles (la seconde masque silencieusement
// les exports de la première).
vi.mock("@/features/lab/api", () => ({
  getRun: vi.fn(),
  listRuns: vi.fn(),
  cancelRun: vi.fn(),
  compareRuns: vi.fn(),
}));

const RUN: RunDetail = {
  id: "run-1",
  experimentName: "legal-bert baseline",
  task: "T1_primary",
  status: "succeeded",
  progress: 100,
  phase: "",
  macroF1: 0.68,
  errorCode: "",
  createdAt: "2026-08-11T09:00:00Z",
  completedAt: "2026-08-11T09:05:00Z",
  computeTarget: "local",
  computeSite: null,
  startedAt: "2026-08-11T09:00:05Z",
  heartbeatAt: "2026-08-11T09:05:00Z",
  cancelRequested: false,
  config: {},
  environment: {},
  externalJobId: "",
  errorDetail: "",
  attempt: 1,
  // Reproduit fidèlement ce que le middleware de camélisation DRF livre réellement
  // (vérifié contre un vrai run exécuté en local, pas deviné) : le `results.json` produit
  // par `pactiva_lab` est en snake_case Python idiomatique, mais TOUT JSONField traverse
  // la même camélisation HTTP que le reste de l'API avant d'atteindre le front — une
  // fixture en snake_case masquerait exactement le bug que ce test doit prévenir.
  metrics: {
    task: "T1_primary",
    preprocess: "detok=regex_rules",
    metrics: { macroF1: 0.68, microF1: 0.79, ece: 0.12 },
    perFold: [{ macroF1: 0.65 }, { macroF1: 0.71 }],
    perLabel: [
      { label: "PREAMBLE_SCOPE", f1: 0.82, support: 1163 },
      { label: "FEEDBACK", f1: 0.12, support: 31 },
    ],
    humanCeiling: { value: 0.74, metric: "macroF1", note: "borne supérieure réaliste" },
    errors: {
      confusionMatrix: { labels: ["A", "B"], matrix: [[8, 2], [1, 9]] },
    },
  },
};

describe("RunResults", () => {
  it("affiche le plafond humain à côté du score, jamais seul", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce(RUN);
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    await waitFor(() => expect(screen.getByTestId("run-results")).toBeInTheDocument());
    const kpis = screen.getByTestId("run-metrics-kpis");
    expect(kpis.textContent).toContain("0.680");
    expect(kpis.textContent).toContain("0.740");
  });

  it("⭐ lit les métriques en camelCase, pas en snake_case Python du results.json brut", async () => {
    // Régression trouvée en pilotant un vrai navigateur contre un vrai run exécuté
    // localement (torch/sentence-transformers) : le composant lisait `metrics.macro_f1`,
    // `run.metrics.human_ceiling`, `.per_label`, `.per_fold`, `.reliability_curve` —
    // mais le middleware DRF camélise récursivement CE JSONField comme le reste de la
    // réponse HTTP. Résultat en conditions réelles : macro-F1/micro-F1/plafond humain
    // affichaient tous "—", et F6 (score par thème) ne s'affichait pas du tout, alors
    // que le run avait réellement produit ces chiffres.
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce(RUN);
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    await waitFor(() => expect(screen.getByTestId("run-results")).toBeInTheDocument());
    const kpis = screen.getByTestId("run-metrics-kpis");
    expect(kpis.textContent).not.toContain("—");
    expect(screen.getByTestId("figure-label-scores-table")).toBeInTheDocument();
    expect(screen.getByTestId("run-per-fold")).toBeInTheDocument();
  });

  it("un run en échec explique pourquoi, sans afficher de figures", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce({
      ...RUN,
      status: "failed",
      errorCode: "g5k_unreachable",
      errorDetail: "API injoignable",
    });
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    await waitFor(() => expect(screen.getByTestId("run-results-not-ready")).toBeInTheDocument());
    expect(screen.getByText("API injoignable")).toBeInTheDocument();
  });

  it("un run partiel (walltime) le signale explicitement", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce({ ...RUN, status: "partial" });
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    await waitFor(() => expect(screen.getByTestId("run-results")).toBeInTheDocument());
    expect(screen.getByText(/résultats partiels/i)).toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------- //
// Comparaison de runs depuis la liste
// --------------------------------------------------------------------------- //

// --------------------------------------------------------------------------- //
// Cible de calcul — Local vs Grid'5000 (audit UI Lab, 14 août 2026 : rien
// n'affichait explicitement où une expérience s'exécute)
// --------------------------------------------------------------------------- //

describe("RunList — colonne Cible", () => {
  it("distingue un run local d'un run Grid'5000, avec le site s'il est déclaré", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([
      { id: "1", experimentName: "tfidf", task: "T1_primary", status: "succeeded",
        progress: 100, phase: "", macroF1: 0.55, errorCode: "", createdAt: "", completedAt: "",
        computeTarget: "local", computeSite: null },
      { id: "2", experimentName: "legal-bert", task: "T1_primary", status: "succeeded",
        progress: 100, phase: "", macroF1: 0.68, errorCode: "", createdAt: "", completedAt: "",
        computeTarget: "g5k", computeSite: "nancy" },
    ] as never);
    const { RunList } = await import("@/features/lab/RunList");
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    const row1 = await screen.findByTestId("run-1");
    expect(row1.textContent).toContain("Local");
    const row2 = screen.getByTestId("run-2");
    expect(row2.textContent).toContain("Grid'5000");
    expect(row2.textContent).toContain("nancy");
  });
});

describe("RunResults — badge de cible dans l'en-tête", () => {
  it("affiche Grid'5000 + le site pour un run exécuté sur la grille", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce({
      ...RUN, computeTarget: "g5k", computeSite: "nancy",
    } as never);
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    const badge = await screen.findByTestId("compute-target-badge");
    expect(badge.textContent).toContain("Grid'5000");
    expect(badge.textContent).toContain("nancy");
  });

  it("affiche Local, sans site, pour un run exécuté sur le VPS", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce({ ...RUN } as never); // RUN: computeTarget local
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    const badge = await screen.findByTestId("compute-target-badge");
    expect(badge.textContent).toContain("Local");
    expect(badge.textContent).not.toContain("Grid'5000");
  });

  it("⭐ affiche l'identifiant du job OAR quand il existe — seul moyen de croiser avec les outils Grid'5000 en cas de blocage", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce({
      ...RUN, computeTarget: "g5k", computeSite: "nancy", externalJobId: "1234567",
    } as never);
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    expect(await screen.findByTestId("run-external-job-id")).toHaveTextContent("1234567");
  });

  it("n'affiche rien pour un run local (jamais de job OAR)", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce({ ...RUN, externalJobId: "" } as never);
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    await screen.findByTestId("run-results");
    expect(screen.queryByTestId("run-external-job-id")).not.toBeInTheDocument();
  });
});

describe("RunList — comparaison", () => {
  const runs = [
    { id: "1", experimentName: "legal-bert", task: "T1_primary", status: "succeeded",
      progress: 100, phase: "", macroF1: 0.68, errorCode: "", createdAt: "", completedAt: "" },
    { id: "2", experimentName: "tfidf", task: "T1_primary", status: "succeeded",
      progress: 100, phase: "", macroF1: 0.55, errorCode: "", createdAt: "", completedAt: "" },
  ] as const;

  it("le bouton comparer dit pourquoi il est désactivé sous deux sélections", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([...runs] as never);
    const { RunList } = await import("@/features/lab/RunList");
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    const button = await screen.findByTestId("run-compare-button");
    expect(button).toBeDisabled();
    expect(button.getAttribute("title")).toMatch(/au moins deux runs/i);
  });

  it("⭐ ne rappelle PAS listRuns en boucle après un rafraîchissement réussi", async () => {
    // Régression : l'effet de sondage dépendait de `runs`, que `refresh()` modifie —
    // chaque succès redéclenchait aussitôt un nouvel appel, jusqu'à épuiser un mock à
    // usage unique et planter sur `undefined.then`.
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValue([...runs] as never);
    const { RunList } = await import("@/features/lab/RunList");
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    await screen.findByTestId("run-list");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(vi.mocked(api.listRuns).mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("refuse explicitement une comparaison sur des plis différents", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([...runs] as never);
    vi.mocked(api.compareRuns).mockResolvedValueOnce({
      comparable: false,
      incomparableReason: "plis différents : les scores ne sont pas comparables",
      rows: [],
    });
    const { RunList } = await import("@/features/lab/RunList");
    const user = (await import("@testing-library/user-event")).default;
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    await user.click(await screen.findByTestId("run-select-1"));
    await user.click(screen.getByTestId("run-select-2"));
    await user.click(screen.getByTestId("run-compare-button"));

    await waitFor(() => expect(screen.getByTestId("run-compare-refused")).toBeInTheDocument());
    expect(screen.getByTestId("run-compare-refused").textContent).toMatch(/plis différents/i);
  });

  it("une comparaison valide rend la figure F9", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([...runs] as never);
    vi.mocked(api.compareRuns).mockResolvedValueOnce({
      comparable: true,
      incomparableReason: null,
      rows: [
        { runId: "1", label: "legal-bert", value: 0.68, humanCeiling: 0.74 },
        { runId: "2", label: "tfidf", value: 0.55, humanCeiling: 0.74 },
      ],
    });
    const { RunList } = await import("@/features/lab/RunList");
    const user = (await import("@testing-library/user-event")).default;
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    await user.click(await screen.findByTestId("run-select-1"));
    await user.click(screen.getByTestId("run-select-2"));
    await user.click(screen.getByTestId("run-compare-button"));

    await waitFor(() => expect(screen.getByTestId("figure-run-comparison")).toBeInTheDocument());
  });

  it("⭐ un run en cours affiche une barre de progression réelle, pas un saut brutal 0→100", async () => {
    // Le backend sondait déjà `run.progress`/`run.phase` mais rien ne les rendait avant
    // ce lot : ils n'apparaissaient qu'en texte discret (« · pli 3/5 »), jamais en barre.
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([
      {
        id: "3", experimentName: "en-cours", task: "T1_primary", status: "running",
        progress: 62, phase: "pli 3/5", macroF1: null, errorCode: "", createdAt: "",
        completedAt: null,
      },
    ] as never);
    const { RunList } = await import("@/features/lab/RunList");
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    const bar = await screen.findByTestId("run-progress-3");
    expect(bar).toHaveAttribute("aria-valuenow", "62");
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("62%");
  });

  it("un run terminé n'affiche pas de barre de progression (plus rien à suivre)", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([...runs] as never);
    const { RunList } = await import("@/features/lab/RunList");
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    await screen.findByTestId("run-list");
    expect(screen.queryByTestId("run-progress-1")).not.toBeInTheDocument();
  });

  it("⭐ un run G5K en cours, progress=0, affiche une barre INDÉTERMINÉE plutôt qu'un faux 0% figé", async () => {
    // `progress` ne bouge en direct QUE pour les runs locaux (audit UI/UX, 15 août
    // 2026) : pour Grid'5000 il reste à 0 pendant toute l'attente/exécution distante,
    // puis saute à 100 à l'ingestion. Un 0% qui ne bouge jamais mentirait sur l'état
    // réel du job — l'indéterminée dit honnêtement « ça avance, sans chiffre fiable ».
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([
      { id: "4", experimentName: "g5k-en-cours", task: "T1_primary", status: "running",
        progress: 0, phase: "running", macroF1: null, errorCode: "", createdAt: "",
        completedAt: null, computeTarget: "g5k", computeSite: "nancy" },
    ] as never);
    const { RunList } = await import("@/features/lab/RunList");
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    const bar = await screen.findByTestId("run-progress-4");
    expect(bar).toHaveAttribute("data-indeterminate", "true");
    expect(bar).not.toHaveAttribute("aria-valuenow");
  });

  it("⭐ un run `waiting` (en file Grid'5000) affiche aussi phase et progression — pas seulement `running`", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([
      { id: "5", experimentName: "en-attente", task: "T1_primary", status: "waiting",
        progress: 0, phase: "waiting", macroF1: null, errorCode: "", createdAt: "",
        completedAt: null, computeTarget: "g5k", computeSite: "nancy",
        startedAt: "2026-08-15T09:00:00Z" },
    ] as never);
    const { RunList } = await import("@/features/lab/RunList");
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    expect(await screen.findByTestId("run-progress-5")).toBeInTheDocument();
    expect(screen.getByTestId("run-elapsed-5")).toBeInTheDocument();
  });

  it("⭐ toutes les lignes sont cliquables, y compris un run en cours (avant : seulement les runs terminés)", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([
      { id: "6", experimentName: "en-cours", task: "T1_primary", status: "running",
        progress: 40, phase: "", macroF1: null, errorCode: "", createdAt: "",
        completedAt: null },
    ] as never);
    const { RunList } = await import("@/features/lab/RunList");
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    const link = await screen.findByTestId("run-link-6");
    expect(link).toHaveAttribute("href", "/projects/demo/lab/runs/6");
  });

  it("⭐ annuler demande confirmation, et n'appelle l'API que si elle est acceptée", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([
      { id: "7", experimentName: "a-annuler", task: "T1_primary", status: "running",
        progress: 10, phase: "", macroF1: null, errorCode: "", createdAt: "",
        completedAt: null, computeTarget: "g5k", computeSite: "nancy" },
    ] as never);
    vi.mocked(api.cancelRun).mockResolvedValue({ status: "cancelling" });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    const { RunList } = await import("@/features/lab/RunList");
    const user = (await import("@testing-library/user-event")).default;
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    await user.click(await screen.findByTestId("run-cancel-7"));
    expect(confirmSpy).toHaveBeenCalled();
    // Confirmation refusée : action de fond passe pas.
    expect(api.cancelRun).not.toHaveBeenCalled();

    confirmSpy.mockReturnValueOnce(true);
    await user.click(screen.getByTestId("run-cancel-7"));
    expect(api.cancelRun).toHaveBeenCalledWith("demo", "7");
    confirmSpy.mockRestore();
  });

  it("⭐ un échec d'annulation ne reste pas silencieux — la queue d'erreurs globale le capte", async () => {
    // Auparavant : `cancelRun(slug, run.id).then(refresh)` sans `.catch`, un échec
    // réseau/API disparaissait sans aucun signal utilisateur (audit UI/UX, 15 août 2026).
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([
      { id: "8", experimentName: "echoue", task: "T1_primary", status: "running",
        progress: 5, phase: "", macroF1: null, errorCode: "", createdAt: "",
        completedAt: null },
    ] as never);
    const { ApiError } = await import("@/lib/api/client");
    vi.mocked(api.cancelRun).mockRejectedValueOnce(new ApiError(500, "API 500 on /runs/8/cancel"));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    useApiErrorStore.setState({ errors: [] });
    const { RunList } = await import("@/features/lab/RunList");
    const user = (await import("@testing-library/user-event")).default;
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    await user.click(await screen.findByTestId("run-cancel-8"));
    await waitFor(() => expect(useApiErrorStore.getState().errors.length).toBeGreaterThan(0));
  });

  it("⭐ une annulation déjà acceptée par le serveur remplace le bouton — pas recliquable", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([
      { id: "9", experimentName: "deja-demande", task: "T1_primary", status: "running",
        progress: 20, phase: "", macroF1: null, errorCode: "", createdAt: "",
        completedAt: null, cancelRequested: true },
    ] as never);
    const { RunList } = await import("@/features/lab/RunList");
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    expect(await screen.findByTestId("run-cancel-pending-9")).toBeInTheDocument();
    expect(screen.queryByTestId("run-cancel-9")).not.toBeInTheDocument();
  });

  it("⭐ deux annulations rapprochées sur des runs différents gardent un état de chargement INDÉPENDANT par ligne", async () => {
    // `cancelMutation` est UNE seule instance partagée par toutes les lignes — l'état
    // de chargement par ligne doit venir d'un état local par run, pas de
    // `cancelMutation.variables` (qui ne refléterait que le DERNIER appel et ferait
    // réapparaître à tort le bouton de la première ligne). Revue adversariale du
    // 15 août 2026, trouvée indépendamment par les deux réviseurs.
    const api = await import("@/features/lab/api");
    const fixture = [
      { id: "10", experimentName: "a", task: "T1_primary", status: "running", progress: 1,
        phase: "", macroF1: null, errorCode: "", createdAt: "", completedAt: null },
      { id: "11", experimentName: "b", task: "T1_primary", status: "running", progress: 1,
        phase: "", macroF1: null, errorCode: "", createdAt: "", completedAt: null },
    ];
    // `mockResolvedValue` (persistant) en filet : le succès de l'annulation de "11"
    // déclenche un `refresh()` qui rappelle `listRuns` — un simple `...Once` laisserait
    // cet appel supplémentaire retomber sur un mock non configuré (`undefined`, pas une
    // promesse), qui planterait `refresh()` et viderait tout le tableau.
    vi.mocked(api.listRuns).mockResolvedValue(fixture as never);
    let resolveFirst!: () => void;
    vi.mocked(api.cancelRun).mockImplementation((_slug, runId) => {
      if (runId === "10") {
        return new Promise((resolve) => {
          resolveFirst = () => resolve({ status: "cancelling" });
        });
      }
      return Promise.resolve({ status: "cancelling" });
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { RunList } = await import("@/features/lab/RunList");
    const user = (await import("@testing-library/user-event")).default;
    render(<RunList slug="demo" />, { wrapper: wrapper() });

    // Annule "10" en premier (requête jamais résolue pour l'instant) — bouton en charge.
    await user.click(await screen.findByTestId("run-cancel-10"));
    await waitFor(() => expect(screen.getByTestId("run-cancel-10")).toHaveAttribute("aria-busy", "true"));

    // Annule "11" ensuite (se résout immédiatement) — ne doit PAS libérer le bouton de "10".
    await user.click(screen.getByTestId("run-cancel-11"));
    await waitFor(() => expect(api.cancelRun).toHaveBeenCalledWith("demo", "11"));
    expect(screen.getByTestId("run-cancel-10")).toHaveAttribute("aria-busy", "true");

    resolveFirst();
    await waitFor(() =>
      expect(screen.getByTestId("run-cancel-10")).not.toHaveAttribute("aria-busy", "true"),
    );
  });
});

// --------------------------------------------------------------------------- //
// Suivi vivant d'un run en cours (audit UI/UX, 15 août 2026)
// --------------------------------------------------------------------------- //

describe("RunResults — suivi vivant d'un run non terminé", () => {
  // Relatif à l'instant du test, jamais un calendrier figé : `isStaleHeartbeat` compare
  // à `Date.now()` RÉEL, un horodatage codé en dur deviendrait « périmé » de lui-même
  // au fil des exécutions futures de cette suite.
  const LIVE_RUN: RunDetail = {
    ...RUN,
    status: "running",
    progress: 45,
    phase: "pli 2/5",
    startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    heartbeatAt: new Date(Date.now() - 30_000).toISOString(),
    attempt: 1,
  };

  it("affiche phase, progression et depuis-quand pour un run en cours", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce(LIVE_RUN);
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    await waitFor(() => expect(screen.getByTestId("run-live-tracking")).toBeInTheDocument());
    expect(screen.getByTestId("run-progress-detail")).toHaveAttribute("aria-valuenow", "45");
    expect(screen.getByTestId("run-elapsed-detail")).toBeInTheDocument();
    expect(screen.getByTestId("run-cancel-detail")).toBeInTheDocument();
  });

  it("⭐ un battement ancien (> 20 min) signale un run potentiellement bloqué", async () => {
    // `heartbeat_at` n'atteignait même pas le frontend avant ce lot (absent des DEUX
    // sérialiseurs) — aucun moyen de distinguer un worker mort d'un job qui progresse.
    const api = await import("@/features/lab/api");
    const old = new Date(Date.now() - 25 * 60_000).toISOString();
    vi.mocked(api.getRun).mockResolvedValueOnce({ ...LIVE_RUN, heartbeatAt: old });
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    expect(await screen.findByTestId("run-stale-heartbeat")).toBeInTheDocument();
  });

  it("un battement récent n'affiche AUCUN avertissement", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce(LIVE_RUN);
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    await waitFor(() => expect(screen.getByTestId("run-live-tracking")).toBeInTheDocument());
    expect(screen.queryByTestId("run-stale-heartbeat")).not.toBeInTheDocument();
  });

  it("⭐ une reprise après incident (tentative > 1) est signalée à l'utilisateur, avec un token sémantique (pas noyée en gris)", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce({ ...LIVE_RUN, attempt: 2 });
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    const warning = await screen.findByTestId("run-attempt-warning");
    expect(warning.textContent).toMatch(/tentative 2/);
    expect(warning.className).toContain("text-warning");
  });

  it("aucune reprise (tentative 1) → pas d'avertissement", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce(LIVE_RUN);
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    await waitFor(() => expect(screen.getByTestId("run-live-tracking")).toBeInTheDocument());
    expect(screen.queryByTestId("run-attempt-warning")).not.toBeInTheDocument();
  });

  it("⭐ une annulation déjà acceptée par le serveur remplace le bouton par un état non recliquable", async () => {
    // `cancel_requested` est posé de manière SYNCHRONE par `POST .../cancel`, avant
    // même que `status` ne bascule sur `cancelled` — sans ce rendu, rien ne distingue
    // une annulation déjà en vol d'un bouton qui n'a jamais été cliqué (revue
    // adversariale du 15 août 2026, trouvée indépendamment par les deux réviseurs).
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce({ ...LIVE_RUN, cancelRequested: true });
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    expect(await screen.findByTestId("run-cancel-pending-detail")).toBeInTheDocument();
    expect(screen.queryByTestId("run-cancel-detail")).not.toBeInTheDocument();
  });

  it("⭐ un run `queued` reste annulable mais n'affiche aucune progression — cohérent avec RunList", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce({
      ...LIVE_RUN, status: "queued", phase: "", progress: 0, startedAt: null,
    });
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    await waitFor(() => expect(screen.getByTestId("run-results-not-ready")).toBeInTheDocument());
    expect(screen.queryByTestId("run-live-tracking")).not.toBeInTheDocument();
    expect(screen.getByTestId("run-cancel-detail")).toBeInTheDocument();
  });

  it("un run G5K en cours, progress=0, affiche une progression indéterminée", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce({
      ...LIVE_RUN, computeTarget: "g5k", computeSite: "nancy", progress: 0, phase: "waiting",
      status: "waiting",
    });
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    const bar = await screen.findByTestId("run-progress-detail");
    expect(bar).toHaveAttribute("data-indeterminate", "true");
  });

  it("un run annulé l'indique sans afficher de figures", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce({ ...LIVE_RUN, status: "cancelled" });
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />, { wrapper: wrapper() });

    await waitFor(() => expect(screen.getByTestId("run-results-not-ready")).toBeInTheDocument());
    expect(screen.getByText(/a été annulé/i)).toBeInTheDocument();
    expect(screen.queryByTestId("run-live-tracking")).not.toBeInTheDocument();
  });
});
