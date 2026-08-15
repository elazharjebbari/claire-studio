/**
 * Analyse de sweep (`sweepAnalysis.ts`) — ajustement loi de puissance (avec parité
 * contre une implémentation Python indépendante), effets marginaux, règle de survie.
 */

import { describe, expect, it } from "vitest";

import golden from "./fixtures/powerlaw.golden.json";
import {
  extrapolationLimit,
  fitPowerLaw,
  marginalAxisEffects,
  powerLawValue,
  survivalSet,
  variantLabel,
} from "@/features/lab/sweepAnalysis";

describe("fitPowerLaw", () => {
  it("⭐ parité avec l'implémentation Python indépendante (golden partagé)", () => {
    for (const dataset of golden.datasets) {
      const fit = fitPowerLaw(dataset.points);
      if (dataset.expected === null) {
        expect(fit, dataset.name).toBeNull();
      } else {
        expect(fit, dataset.name).not.toBeNull();
        expect(fit!.a, dataset.name).toBeCloseTo(dataset.expected.a, 6);
        expect(fit!.b, dataset.name).toBeCloseTo(dataset.expected.b, 6);
        expect(fit!.c, dataset.name).toBeCloseTo(dataset.expected.c, 6);
      }
    }
  });

  it("retrouve les paramètres d'une loi de puissance propre", () => {
    const points = [5, 10, 20, 40, 80].map((x) => ({ x, y: 0.6 - 0.5 * x ** -0.4 }));
    const fit = fitPowerLaw(points)!;
    expect(fit.a).toBeCloseTo(0.6, 2);
    expect(fit.c).toBeCloseTo(0.4, 1);
  });

  it("⭐ refuse d'ajuster moins de 3 tailles distinctes — pas de courbe sur 2 points", () => {
    expect(fitPowerLaw([{ x: 5, y: 0.3 }, { x: 10, y: 0.4 }])).toBeNull();
    expect(
      fitPowerLaw([
        { x: 5, y: 0.3 }, { x: 5, y: 0.31 }, { x: 10, y: 0.4 }, { x: 10, y: 0.41 },
      ]),
    ).toBeNull();
  });

  it("refuse une dégradation (b ≤ 0) — un artefact, pas un apprentissage", () => {
    const points = [5, 10, 20, 40].map((x) => ({ x, y: 0.6 - 0.002 * x }));
    expect(fitPowerLaw(points)).toBeNull();
  });

  it("l'extrapolation est bornée à 2,5× la plus grande taille observée", () => {
    const points = [5, 10, 20, 39].map((x) => ({ x, y: 0.5 - 0.4 * x ** -0.5 }));
    expect(extrapolationLimit(points)).toBe(98);
    const fit = fitPowerLaw(points)!;
    // La valeur extrapolée reste sous l'asymptote — sanité de powerLawValue.
    expect(powerLawValue(fit, 98)).toBeLessThan(fit.a);
  });
});

describe("marginalAxisEffects", () => {
  it("⭐ grille 2×2 construite → effets marginaux exacts, axe inerte exclu", () => {
    // case ∈ {lower, none} : +0.04 exactement ; ngram ∈ {1, 2} : +0.01 exactement.
    const runs = [
      { config: { preprocess: { case: "lower", ngram: 1 }, datasetId: "d" }, value: 0.45 },
      { config: { preprocess: { case: "lower", ngram: 2 }, datasetId: "d" }, value: 0.46 },
      { config: { preprocess: { case: "none", ngram: 1 }, datasetId: "d" }, value: 0.41 },
      { config: { preprocess: { case: "none", ngram: 2 }, datasetId: "d" }, value: 0.42 },
    ];
    const effects = marginalAxisEffects(runs);
    expect(effects.map((e) => e.axis)).toEqual(["preprocess.case", "preprocess.ngram"]);
    expect(effects[0]!.effect).toBeCloseTo(0.04, 10);
    expect(effects[1]!.effect).toBeCloseTo(0.01, 10);
    expect(effects[0]!.perValue[0]).toMatchObject({ value: "lower", n: 2 });
  });

  it("les runs sans valeur (échoués) sont exclus des moyennes", () => {
    const runs = [
      { config: { a: 1 }, value: 0.5 },
      { config: { a: 2 }, value: 0.4 },
      { config: { a: 2 }, value: null },
    ];
    const effects = marginalAxisEffects(runs);
    expect(effects[0]!.perValue.find((v) => v.value === "2")!.n).toBe(1);
  });

  it("datasetId ne devient jamais un axe (identifiant, pas un choix d'expérience)", () => {
    const runs = [
      { config: { datasetId: "x", a: 1 }, value: 0.5 },
      { config: { datasetId: "y", a: 2 }, value: 0.4 },
    ];
    expect(marginalAxisEffects(runs).map((e) => e.axis)).toEqual(["a"]);
  });
});

describe("survivalSet", () => {
  it("⭐ règle « retenue si son IC touche celui de la meilleure »", () => {
    const runs = [
      { id: "best", value: 0.5, ci: { low: 0.46, high: 0.54 } },
      { id: "touche", value: 0.47, ci: { low: 0.43, high: 0.51 } },
      { id: "ecartee", value: 0.4, ci: { low: 0.36, high: 0.44 } },
    ];
    const survivors = survivalSet(runs);
    expect(survivors.has("best")).toBe(true);
    expect(survivors.has("touche")).toBe(true);
    expect(survivors.has("ecartee")).toBe(false);
  });

  it("sans IC, seul le meilleur survit — pas de laissez-passer par absence d'incertitude", () => {
    const runs = [
      { id: "best", value: 0.5, ci: null },
      { id: "second", value: 0.49, ci: null },
    ];
    const survivors = survivalSet(runs);
    expect([...survivors]).toEqual(["best"]);
  });
});

describe("variantLabel", () => {
  it("n'affiche que les axes qui varient, jamais la config entière", () => {
    const runs = [
      { config: { model: { family: "tfidf", ngram: 1 }, seed: 42 } },
      { config: { model: { family: "tfidf", ngram: 2 }, seed: 42 } },
    ];
    expect(variantLabel(runs[0]!.config, runs)).toBe("ngram=1");
    expect(variantLabel(runs[1]!.config, runs)).toBe("ngram=2");
  });

  it("aucune variation → « configuration unique »", () => {
    const runs = [{ config: { a: 1 } }, { config: { a: 1 } }];
    expect(variantLabel(runs[0]!.config, runs)).toBe("configuration unique");
  });
});
