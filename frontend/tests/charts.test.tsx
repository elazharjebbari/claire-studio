/**
 * Échelles et figures — la logique est pure, donc testable comme le reste du métier.
 *
 * Les cas limites vérifiés ici (domaine vide, valeur unique, zéro en échelle log) sont
 * exactement ceux qui produisent un `NaN` dans un chemin SVG et une figure muette qu'on
 * ne remarque qu'à la relecture de l'article.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import {
  extent,
  formatPercent,
  formatTick,
  linePath,
  logTicks,
  scaleBand,
  scaleLinear,
  scaleLog,
  ticks,
} from "@/features/analysis/charts/scales";
import { SERIES_SLOTS, seriesColor, sequentialOpacity } from "@/features/analysis/charts/palette";
import { toCsv } from "@/features/analysis/charts/Figure";
import {
  AgreementMatrixFigure,
  AlphaComparisonFigure,
  BoundaryAgreementFigure,
  CooccurrenceFigure,
  GoldCascadeFigure,
  LongTailFigure,
} from "@/features/analysis/charts/figures";

afterEach(cleanup);

// --------------------------------------------------------------------------- //
// Échelles
// --------------------------------------------------------------------------- //

describe("extent", () => {
  it("série vide → domaine sûr, jamais NaN", () => {
    expect(extent([])).toEqual({ min: 0, max: 1 });
  });

  it("série constante → domaine élargi (sinon division par zéro)", () => {
    const range = extent([5, 5, 5]);
    expect(range.min).toBeLessThan(range.max);
  });

  it("série constante à zéro → domaine 0..1", () => {
    expect(extent([0, 0])).toEqual({ min: 0, max: 1 });
  });

  it("ignore les valeurs non finies", () => {
    expect(extent([1, NaN, 10, Infinity])).toEqual({ min: 1, max: 10 });
  });
});

describe("scaleLinear", () => {
  it("projette le domaine sur la plage", () => {
    const scale = scaleLinear({ min: 0, max: 10 }, { min: 0, max: 100 });
    expect(scale(0)).toBe(0);
    expect(scale(5)).toBe(50);
    expect(scale(10)).toBe(100);
  });

  it("plage inversée (l'axe y du SVG descend)", () => {
    const scale = scaleLinear({ min: 0, max: 1 }, { min: 200, max: 0 });
    expect(scale(0)).toBe(200);
    expect(scale(1)).toBe(0);
  });

  it("domaine dégénéré → constante, jamais NaN", () => {
    const scale = scaleLinear({ min: 3, max: 3 }, { min: 0, max: 100 });
    expect(Number.isFinite(scale(3))).toBe(true);
  });
});

describe("scaleLog", () => {
  it("projette les puissances de dix régulièrement", () => {
    const scale = scaleLog({ min: 1, max: 1000 }, { min: 0, max: 300 });
    expect(scale(1)).toBeCloseTo(0);
    expect(scale(10)).toBeCloseTo(100);
    expect(scale(1000)).toBeCloseTo(300);
  });

  it("zéro et négatifs sont projetés sur le minimum, jamais NaN", () => {
    const scale = scaleLog({ min: 1, max: 100 }, { min: 0, max: 200 });
    expect(scale(0)).toBe(0);
    expect(scale(-5)).toBe(0);
    expect(Number.isNaN(scale(0))).toBe(false);
  });
});

describe("ticks", () => {
  it("produit des valeurs rondes", () => {
    expect(ticks({ min: 0, max: 1 }, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it("jamais de 0.30000000000000004", () => {
    for (const value of ticks({ min: 0, max: 1 }, 10)) {
      expect(String(value).length).toBeLessThan(8);
    }
  });

  it("domaine nul → une seule graduation", () => {
    expect(ticks({ min: 5, max: 5 })).toEqual([5]);
  });
});

describe("logTicks", () => {
  it("ne renvoie que les puissances de dix du domaine", () => {
    expect(logTicks({ min: 1, max: 1000 })).toEqual([1, 10, 100, 1000]);
  });

  it("domaine étroit → au moins une graduation", () => {
    expect(logTicks({ min: 3, max: 7 }).length).toBeGreaterThan(0);
  });
});

describe("scaleBand", () => {
  it("les bandes tiennent dans la plage", () => {
    const band = scaleBand(4, { min: 0, max: 400 });
    expect(band.position(0)).toBeGreaterThanOrEqual(0);
    expect(band.position(3) + band.bandwidth).toBeLessThanOrEqual(400);
  });

  it("zéro catégorie ne casse pas", () => {
    expect(scaleBand(0, { min: 0, max: 100 }).bandwidth).toBeGreaterThan(0);
  });
});

describe("linePath", () => {
  it("les points non finis coupent le trait au lieu de le corrompre", () => {
    const path = linePath([[0, 0], [10, 10], [NaN, 5], [20, 20]]);
    expect(path).not.toContain("NaN");
    // Deux segments : le trait reprend après la coupure.
    expect(path.match(/M/g)?.length).toBe(2);
  });
});

describe("formatage", () => {
  it("formatTick abrège les milliers", () => {
    expect(formatTick(1163)).toBe("1.2k");
    expect(formatTick(0.5)).toBe("0.5");
  });

  it("formatPercent gère l'absence de valeur", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(0.635)).toBe("63.5 %");
  });
});

// --------------------------------------------------------------------------- //
// Palette
// --------------------------------------------------------------------------- //

describe("palette", () => {
  it("les emplacements de série sont des variables CSS, jamais des hex", () => {
    for (let i = 0; i < SERIES_SLOTS; i += 1) {
      expect(seriesColor(i)).toMatch(/^var\(--viz-series-\d\)$/);
    }
  });

  it("au-delà de quatre séries, on ne cycle PAS les teintes", () => {
    // Réutiliser une teinte créerait deux séries de même couleur dans la même figure.
    expect(seriesColor(4)).not.toBe(seriesColor(0));
    expect(seriesColor(4)).toBe("var(--viz-ink-muted)");
  });

  it("l'échelle séquentielle garde un plancher visible", () => {
    // Une valeur faible doit se lire « faible », pas « absente » : ce n'est pas pareil.
    expect(sequentialOpacity(0)).toBeGreaterThan(0);
    expect(sequentialOpacity(1)).toBeLessThanOrEqual(1);
    expect(sequentialOpacity(0.5)).toBeLessThan(sequentialOpacity(1));
  });
});

// --------------------------------------------------------------------------- //
// Export CSV
// --------------------------------------------------------------------------- //

describe("toCsv", () => {
  it("échappe les virgules et les guillemets", () => {
    const csv = toCsv(
      [{ key: "a", label: "Thème" }],
      [{ a: 'LICENSE_IP, "primaire"' }],
    );
    expect(csv.split("\n")[1]).toBe('"LICENSE_IP, ""primaire"""');
  });

  it("les valeurs nulles deviennent vides, pas 'null'", () => {
    expect(toCsv([{ key: "a", label: "A" }], [{ a: null }])).toBe("A\n");
  });
});

// --------------------------------------------------------------------------- //
// Figures
// --------------------------------------------------------------------------- //

describe("AlphaComparisonFigure", () => {
  const report = {
    alphaMasi: 0.635,
    alphaNominal: 0.701,
    multiLabelCost: 0.066,
    thresholds: { acceptable: 0.667, reliable: 0.8 },
    perTheme: [],
    units: 1911,
  };

  it("affiche les deux mesures et le coût", () => {
    render(<AlphaComparisonFigure report={report} />);
    expect(screen.getByTestId("figure-alpha")).toBeInTheDocument();
    // Deux occurrences attendues : l'étiquette directe du graphe ET la cellule du
    // tableau équivalent, qui reste toujours dans le DOM.
    expect(screen.getAllByText("0.635").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0.701").length).toBeGreaterThan(0);
  });

  it("l'équivalent tabulaire est toujours dans le DOM (a11y + export)", () => {
    render(<AlphaComparisonFigure report={report} />);
    const table = screen.getByTestId("figure-alpha-table");
    expect(table).toBeInTheDocument();
    expect(table.textContent).toContain("sous le seuil"); // 0,635 < 0,667
  });

  it("état vide : le message DIT quoi faire", () => {
    render(<AlphaComparisonFigure report={null} />);
    const empty = screen.getByTestId("figure-alpha-empty");
    expect(empty.textContent).toMatch(/soumettre au moins deux annotations/i);
  });

  it("⭐ un rapport présent mais À ZÉRO PHRASE MULTI-ANNOTÉE déclenche aussi l'état vide", () => {
    // Bug réel trouvé en pilotant l'app dans un vrai navigateur (compte à annotation
    // unique) : le backend renvoie un objet `alphaMasi` complet même à 0 phrase
    // multi-annotée (alphaMasi/alphaNominal tous deux `null`). S'en tenir à la seule
    // présence de l'objet remplissait le tableau de trois lignes de tirets, déjouant
    // l'état vide de `Figure` et affichant un graphique SANS AUCUNE BARRE — lu comme
    // cassé, pas comme une absence de données.
    render(
      <AlphaComparisonFigure
        report={{
          alphaMasi: null,
          alphaNominal: null,
          multiLabelCost: null,
          thresholds: { acceptable: 0.667, reliable: 0.8 },
          perTheme: [],
          units: 0,
        }}
      />,
    );
    expect(screen.getByTestId("figure-alpha-empty")).toBeInTheDocument();
  });
});

describe("LongTailFigure", () => {
  const themes = [
    { code: "PREAMBLE_SCOPE", primary: 1163, secondary: 0, total: 1163 },
    { code: "FEEDBACK", primary: 31, secondary: 7, total: 38 },
  ];

  it("signale les thèmes rares", () => {
    render(<LongTailFigure themes={themes} rareThreshold={50} />);
    const table = screen.getByTestId("figure-longtail-table");
    expect(table.textContent).toContain("FEEDBACK");
    expect(table.textContent).toContain("oui");
  });

  it("état vide explicite", () => {
    render(<LongTailFigure themes={[]} />);
    expect(screen.getByTestId("figure-longtail-empty")).toBeInTheDocument();
  });

  it("⭐ un code de thème long est tronqué sur l'axe, complet dans le tableau", () => {
    // Bug réel trouvé en pilotant l'app avec de vraies données : le premier bâton du
    // graphique est proche du bord gauche, et un code pivoté à -45° ("PREAMBLE_SCOPE",
    // "MODIFICATION_OF_TERMS") s'étend vers le haut-gauche et sortait du cadre SVG —
    // invisible avec les codes courts des fixtures habituelles.
    render(
      <LongTailFigure
        themes={[{ code: "MODIFICATION_OF_TERMS", primary: 141, secondary: 20, total: 161 }]}
      />,
    );
    // Le SVG affiche une version tronquée (11 caractères max, ellipse comprise)…
    const svgLabel = screen.getByText("MODIFICATI…");
    expect(svgLabel).toBeInTheDocument();
    // …mais le tableau équivalent (et donc l'export CSV) garde le nom complet.
    expect(screen.getByTestId("figure-longtail-table").textContent).toContain(
      "MODIFICATION_OF_TERMS",
    );
  });
});

describe("BoundaryAgreementFigure", () => {
  it("affiche la dispersion réelle, pas un accord parfait", () => {
    render(
      <BoundaryAgreementFigure
        rows={[
          { documentId: 1, jaccard: 0.516, nSentences: 139, annotators: 2 },
          { documentId: 2, jaccard: 0.403, nSentences: 193, annotators: 2 },
        ]}
        themeAgreement={0.769}
      />,
    );
    const table = screen.getByTestId("figure-boundary-table");
    expect(table.textContent).toContain("0.516");
    expect(table.textContent).toContain("0.403");
  });

  it("aucun document multi-annoté → message explicite", () => {
    render(<BoundaryAgreementFigure rows={[]} />);
    expect(screen.getByTestId("figure-boundary-empty").textContent).toMatch(
      /deux annotateurs/i,
    );
  });
});

describe("AgreementMatrixFigure", () => {
  it("rend une cellule par paire comparable", () => {
    render(
      <AgreementMatrixFigure
        actors={[
          { key: "human:1", kind: "human" },
          { key: "human:2", kind: "human" },
          { key: "llm:fable", kind: "llm" },
        ]}
        cells={[
          { a: "human:1", b: "human:2", agreement: 0.8, n: 500, kind: "human_human" },
          { a: "human:1", b: "llm:fable", agreement: 0.53, n: 500, kind: "human_llm" },
        ]}
        humanMean={0.8}
        crossMean={0.53}
      />,
    );
    const table = screen.getByTestId("figure-matrix-table");
    expect(table.textContent).toContain("human_human");
    expect(table.textContent).toContain("human_llm");
  });
});

describe("GoldCascadeFigure", () => {
  it("affiche la part de chaque niveau de la cascade", () => {
    render(
      <GoldCascadeFigure
        data={{
          byAutoLevel: { auto_1click: 222, auto: 68, manual: 135 },
          sentences: 425,
          decided: 290,
        }}
      />,
    );
    const table = screen.getByTestId("figure-gold-cascade-table");
    expect(table.textContent).toContain("unanime (auto)");
    expect(table.textContent).toContain("arbitrage");
  });

  it("état vide : la cascade n'a rien à trancher", () => {
    render(<GoldCascadeFigure data={null} />);
    expect(screen.getByTestId("figure-gold-cascade-empty").textContent).toMatch(
      /rien à trancher/i,
    );
  });

  it("⭐ un objet présent mais À ZÉRO PHRASE bascule aussi en état vide", () => {
    render(<GoldCascadeFigure data={{ byAutoLevel: {}, sentences: 0, decided: 0 }} />);
    expect(screen.getByTestId("figure-gold-cascade-empty")).toBeInTheDocument();
  });
});

describe("CooccurrenceFigure", () => {
  const pairs = [
    { themes: ["LICENSE_IP", "TERMINATION"], count: 13, unfair: 10, unfairRate: 0.77, lift: 7.4 },
    { themes: ["META", "PREAMBLE_SCOPE"], count: 45, unfair: 0, unfairRate: 0, lift: 0 },
  ];

  it("classe les paires par lift, la plus forte en tête", () => {
    render(<CooccurrenceFigure pairs={pairs} cardinalityLift={1.09} />);
    const table = screen.getByTestId("figure-cooccurrence-table");
    const rows = table.querySelectorAll("tbody tr");
    expect(rows[0]?.textContent).toContain("LICENSE_IP + TERMINATION");
  });

  it("rapporte le contre-résultat de cardinalité en légende", () => {
    render(<CooccurrenceFigure pairs={pairs} cardinalityLift={1.09} />);
    expect(screen.getByTestId("figure-cooccurrence").textContent).toContain("1.09×");
  });

  it("filtre les paires sous le support minimal", () => {
    render(<CooccurrenceFigure pairs={pairs} minSupport={20} />);
    const table = screen.getByTestId("figure-cooccurrence-table");
    expect(table.textContent).not.toContain("LICENSE_IP");
  });

  it("état vide explicite", () => {
    render(<CooccurrenceFigure pairs={[]} />);
    expect(screen.getByTestId("figure-cooccurrence-empty")).toBeInTheDocument();
  });

  it("⭐ un nom de paire modérément long s'affiche EN ENTIER, sans troncature", () => {
    // Bug réel trouvé en pilotant l'app avec de vraies données : la colonne
    // d'étiquettes était fixée à 190px, assez pour "LICENSE_IP + TERMINATION" mais pas
    // pour "ELIGIBILITY_ACCOUNT + TERMINATION" (34 caractères) — coupé par le bord
    // gauche du SVG. La largeur se calcule maintenant sur le nom le plus long affiché.
    render(
      <CooccurrenceFigure
        pairs={[
          { themes: ["ELIGIBILITY_ACCOUNT", "TERMINATION"], count: 16, unfair: 7,
            unfairRate: 0.44, lift: 4.2 },
        ]}
      />,
    );
    // Le texte VISIBLE de l'étiquette (hors <title> d'accessibilité, qui dupliquerait
    // le contenu du nœud) doit porter le nom en entier, sans ellipse.
    const texts = [
      ...screen.getByTestId("figure-cooccurrence").querySelectorAll("svg text"),
    ];
    const axisLabel = texts.find((t) => t.querySelector("title"))!;
    expect(axisLabel.childNodes[0]?.textContent).toBe("ELIGIBILITY_ACCOUNT + TERMINATION");
  });

  it("⭐ au-delà du plafond, tronque sur l'axe mais garde le nom complet ailleurs", () => {
    const fullName = "MODIFICATION_OF_TERMS + LIMITATION_LIABILITY";
    render(
      <CooccurrenceFigure
        pairs={[{ themes: ["MODIFICATION_OF_TERMS", "LIMITATION_LIABILITY"],
                  count: 12, unfair: 5, unfairRate: 0.42, lift: 3.8 }]}
      />,
    );
    // Le tableau équivalent (et donc l'export CSV) garde le nom complet.
    expect(screen.getByTestId("figure-cooccurrence-table").textContent).toContain(fullName);
    // L'étiquette VISIBLE sur l'axe (le <text>, sans son <title> d'accessibilité) reste
    // bornée — jamais le nom en entier, aussi long soit-il. Ciblée par la présence d'un
    // <title> enfant : c'est la seule étiquette de paire (le repère "base" n'en a pas).
    const texts = [...screen.getByTestId("figure-cooccurrence").querySelectorAll("svg text")];
    const axisLabel = texts.find((t) => t.querySelector("title"))!;
    const visibleText = axisLabel.childNodes[0]?.textContent ?? "";
    expect(visibleText.length).toBeLessThan(fullName.length);
    expect(visibleText.endsWith("…")).toBe(true);
    // …tandis que le <title> (survol) porte bien le nom complet.
    expect(axisLabel.querySelector("title")?.textContent).toBe(fullName);
  });
});
