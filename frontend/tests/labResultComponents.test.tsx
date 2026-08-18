/**
 * Composants transverses des vues de résultats (`resultComponents.tsx`) :
 * intro, verdict, cellule de métrique enrichie, bande de plafond, note de
 * significativité.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  CeilingBand,
  ExperimentIntro,
  MetricCell,
  SignificanceNote,
  VerdictPanel,
} from "@/features/lab/resultComponents";
import type { PairedTestResult } from "@/features/lab/api";
import { usePrefsStore } from "@/store/prefs";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ExperimentIntro", () => {
  it("affiche les cinq blocs (pourquoi / teste / rôle / lire / métriques) pour un preset connu, ouverte par défaut", () => {
    render(<ExperimentIntro preset="learning-curve" />);
    const panel = screen.getByTestId("experiment-intro");
    expect(panel).toHaveAttribute("data-open");
    expect(panel.textContent).toContain("Pourquoi cette expérience");
    expect(panel.textContent).toContain("Ce que teste cette expérience");
    expect(panel.textContent).toContain("Rôle dans la publication");
    expect(panel.textContent).toContain("Comment lire cette page");
    expect(panel.textContent).toContain("quand peut-on arrêter d'annoter");
    expect(panel.textContent).toContain("Notions & métriques de cette page");
  });

  it("⭐ le volet métriques déplie le sens ET la lecture de chaque métrique", async () => {
    const user = userEvent.setup();
    render(<ExperimentIntro preset="iaa-mesure" />);
    await user.click(screen.getByTestId("experiment-intro-metrics-summary"));
    const metrics = screen.getByTestId("experiment-intro-metrics");
    // Une métrique de M1 avec son sens (définition) et sa lecture (seuils concrets).
    expect(metrics.textContent).toContain("α-MASI");
    expect(metrics.textContent).toContain("distance MASI");
    expect(metrics.textContent).toContain("0,667 acceptable");
    // Le paradoxe de prévalence — la lecture couplée α + Gwet.
    expect(metrics.textContent).toContain("Gwet AC1");
  });

  it("preset inconnu → intro générique (jamais un panneau vide), avec les notions transverses", () => {
    render(<ExperimentIntro preset="je-n-existe-pas" />);
    const panel = screen.getByTestId("experiment-intro");
    expect(panel.textContent).toContain("expérience");
    expect(panel.textContent).toContain("libre");
    expect(panel.textContent).toContain("Pourquoi cette expérience");
    expect(panel.textContent).toContain("Notions & métriques de cette page (4)");
  });

  it("⭐ replier l'intro est mémorisé dans les préférences PAR COMPTE", async () => {
    usePrefsStore.setState((s) => ({
      prefs: { ...s.prefs, panels: { ...s.prefs.panels, labIntroCollapsed: false } },
    }));
    const user = userEvent.setup();
    render(<ExperimentIntro preset="baseline-fast" />);

    await user.click(screen.getByTestId("experiment-intro-summary"));
    expect(usePrefsStore.getState().prefs.panels.labIntroCollapsed).toBe(true);
  });

  it("préférence repliée → l'intro démarre fermée", () => {
    usePrefsStore.setState((s) => ({
      prefs: { ...s.prefs, panels: { ...s.prefs.panels, labIntroCollapsed: true } },
    }));
    render(<ExperimentIntro preset="baseline-fast" />);
    expect(screen.getByTestId("experiment-intro")).not.toHaveAttribute("data-open");
  });
});

describe("MetricCell", () => {
  it("valeur + IC + dispersion intégrés, définition accessible via aria-label", () => {
    render(
      <MetricCell
        label="macro-F1"
        value={0.5156}
        ci={{ low: 0.482, high: 0.5578 }}
        dispersion={0.0284}
        definitionKey="macroF1"
        testId="cell"
      />,
    );
    const cell = screen.getByTestId("cell");
    expect(cell.textContent).toContain("0.516");
    expect(cell.textContent).toContain("[0.482 – 0.558]");
    expect(cell.textContent).toContain("± 0.028");
    const info = screen.getByTestId("cell-definition");
    expect(info.getAttribute("aria-label")).toMatch(/thème compte autant/);
  });

  it("sans IC ni définition : juste la valeur, pas d'icône fantôme", () => {
    render(<MetricCell label="ECE" value={0.237} testId="cell-ece" />);
    expect(screen.getByTestId("cell-ece").textContent).toContain("0.237");
    expect(screen.queryByTestId("cell-ece-definition")).not.toBeInTheDocument();
  });
});

describe("CeilingBand", () => {
  it("bande avec valeur, IC et note d'approximation", () => {
    render(
      <CeilingBand
        value={0.494978}
        ci={{ low: 0.471, high: 0.518 }}
        metric="strict_agreement_rate"
        note="Approximation calculée sur le dataset agrégé."
      />,
    );
    const band = screen.getByTestId("ceiling-band");
    expect(band.textContent).toContain("Plafond humain approximé : 0.495");
    expect(band.textContent).toContain("[0.471 – 0.518]");
    expect(band.textContent).toContain("Approximation");
  });

  it("valeur absente → rien (pas de bande vide)", () => {
    render(<CeilingBand value={null} />);
    expect(screen.queryByTestId("ceiling-band")).not.toBeInTheDocument();
  });
});

describe("SignificanceNote", () => {
  const RESULT: PairedTestResult = {
    metric: "macro_f1", delta: 0.0204, low: -0.0042, high: 0.041, pValue: 0.11,
    nDocuments: 39, nResamples: 1000, nPermutations: 2000, unit: "document",
    confidence: 0.95, runA: "a", runB: "b", labelA: "legal-bert", labelB: "embeddings",
    test: "paired_bootstrap+permutation",
  };

  it("Δ, IC, p en toutes lettres avec le test nommé — jamais d'étoiles", () => {
    render(<SignificanceNote result={RESULT} />);
    const note = screen.getByTestId("significance-note");
    expect(note.textContent).toContain("+0.020");
    expect(note.textContent).toContain("[−0.004 – 0.041]");
    expect(note.textContent).toContain("p = 0.110");
    expect(note.textContent).toContain("permutation par document");
    expect(note.textContent).toContain("n = 39 documents");
    expect(note.textContent).not.toMatch(/\*/);
  });

  it("⭐ IC du Δ contenant 0 → « aucune différence démontrée à cet effectif »", () => {
    render(<SignificanceNote result={RESULT} />);
    expect(screen.getByTestId("significance-no-difference").textContent).toMatch(
      /aucune différence démontrée à cet effectif/,
    );
  });

  it("IC excluant 0 → pas de mention « aucune différence »", () => {
    render(<SignificanceNote result={{ ...RESULT, low: 0.004 }} />);
    expect(screen.queryByTestId("significance-no-difference")).not.toBeInTheDocument();
  });

  it("⭐ test indisponible → raison affichée, jamais un silence", () => {
    render(
      <SignificanceNote result={null} unavailableReason="prédictions par phrase absentes" />,
    );
    expect(screen.getByTestId("significance-unavailable").textContent).toContain(
      "test apparié indisponible : prédictions par phrase absentes",
    );
  });

  it("ni résultat ni raison → rien (cas d'une famille sans comparaison)", () => {
    render(<SignificanceNote result={null} />);
    expect(screen.queryByTestId("significance-unavailable")).not.toBeInTheDocument();
    expect(screen.queryByTestId("significance-note")).not.toBeInTheDocument();
  });
});

describe("VerdictPanel", () => {
  it("rend son contenu dans le panneau balisé verdict-panel", () => {
    render(<VerdictPanel>macro-F1 0.516 [0.482 – 0.558]</VerdictPanel>);
    expect(screen.getByTestId("verdict-panel").textContent).toContain("0.516");
  });
});
