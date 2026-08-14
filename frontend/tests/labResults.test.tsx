/**
 * Figures de résultats du Lab (F6/F8/F9/F10) et écran de détail d'un run.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

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
    render(<RunResults slug="demo" runId="run-1" />);

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
    render(<RunResults slug="demo" runId="run-1" />);

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
    render(<RunResults slug="demo" runId="run-1" />);

    await waitFor(() => expect(screen.getByTestId("run-results-not-ready")).toBeInTheDocument());
    expect(screen.getByText("API injoignable")).toBeInTheDocument();
  });

  it("un run partiel (walltime) le signale explicitement", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce({ ...RUN, status: "partial" });
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />);

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
    render(<RunList slug="demo" />);

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
    render(<RunResults slug="demo" runId="run-1" />);

    const badge = await screen.findByTestId("compute-target-badge");
    expect(badge.textContent).toContain("Grid'5000");
    expect(badge.textContent).toContain("nancy");
  });

  it("affiche Local, sans site, pour un run exécuté sur le VPS", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce({ ...RUN } as never); // RUN: computeTarget local
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />);

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
    render(<RunResults slug="demo" runId="run-1" />);

    expect(await screen.findByTestId("run-external-job-id")).toHaveTextContent("1234567");
  });

  it("n'affiche rien pour un run local (jamais de job OAR)", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getRun).mockResolvedValueOnce({ ...RUN, externalJobId: "" } as never);
    const { RunResults } = await import("@/features/lab/RunResults");
    render(<RunResults slug="demo" runId="run-1" />);

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
    render(<RunList slug="demo" />);

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
    render(<RunList slug="demo" />);

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
    render(<RunList slug="demo" />);

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
    render(<RunList slug="demo" />);

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
    render(<RunList slug="demo" />);

    const bar = await screen.findByTestId("run-progress-3");
    expect(bar).toHaveAttribute("aria-valuenow", "62");
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("62%");
  });

  it("un run terminé n'affiche pas de barre de progression (plus rien à suivre)", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.listRuns).mockResolvedValueOnce([...runs] as never);
    const { RunList } = await import("@/features/lab/RunList");
    render(<RunList slug="demo" />);

    await screen.findByTestId("run-list");
    expect(screen.queryByTestId("run-progress-1")).not.toBeInTheDocument();
  });
});
