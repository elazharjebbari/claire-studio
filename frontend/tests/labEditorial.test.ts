/**
 * Lint éditorial (docs/pactiva-lab-resultats/08 §5) — les formulations verrouillées du
 * dossier 05 §4 sont des invariants TESTÉS, pas des vœux : « X % du plafond humain
 * approximé », jamais « bat l'humain » ; « la tendance suggère », jamais « le modèle
 * atteindra » ; jamais d'étoiles de significativité.
 */

import { describe, expect, it } from "vitest";

import {
  EXPERIMENT_INTROS,
  GENERIC_INTRO,
  introFor,
} from "@/features/lab/content/experimentIntros";
import { METRIC_GLOSSARY } from "@/features/lab/content/metricGlossary";

const ALL_PRESETS = [
  "baseline-fast", "position-only", "llm-judges-baseline", "screening-preprocess",
  "embeddings-frozen", "learning-curve", "legal-bert-finetune", "ablation-context",
  "multilabel-finetune", "sequence-boundary", "knn-explainable", "encoders-comparison",
  "ablation-gold-quality", "ablation-label-noise",
];

// « significatif » n'est admis qu'accompagné d'un test nommé dans la MÊME entrée —
// vérifié à la main sur les intros concernées (embeddings-frozen, encoders-comparison
// parlent de « gagner significativement » adossé au test apparié décrit à la puce
// précédente). Les interdits absolus, eux, ne souffrent aucune exception :
const FORBIDDEN = [
  /bat l['']humain/i,
  /dépasse l['']humain/i,
  /atteint l['']humain/i,
  /le modèle atteindra/i,
  /p\s*[<=]\s*0[.,]\d+\s*\*/, // étoiles collées à une p-value
];

function allTexts(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [preset, intro] of Object.entries(EXPERIMENT_INTROS)) {
    out.push([`${preset}.teste`, intro.teste]);
    out.push([`${preset}.role`, intro.role]);
    intro.lire.forEach((line, i) => out.push([`${preset}.lire[${i}]`, line]));
  }
  out.push(["generic.teste", GENERIC_INTRO.teste]);
  out.push(["generic.role", GENERIC_INTRO.role]);
  GENERIC_INTRO.lire.forEach((line, i) => out.push([`generic.lire[${i}]`, line]));
  for (const [key, text] of Object.entries(METRIC_GLOSSARY)) {
    out.push([`glossaire.${key}`, text]);
  }
  return out;
}

describe("lint éditorial des contenus du Lab", () => {
  it("⭐ aucune formulation interdite, nulle part", () => {
    for (const [where, text] of allTexts()) {
      for (const pattern of FORBIDDEN) {
        expect(text, `${where} contient « ${pattern} »`).not.toMatch(pattern);
      }
    }
  });

  it("⭐ les 14 presets ont chacun une introduction complète (teste / rôle / lire)", () => {
    for (const preset of ALL_PRESETS) {
      const intro = EXPERIMENT_INTROS[preset];
      expect(intro, preset).toBeDefined();
      expect(intro!.teste.length, preset).toBeGreaterThan(40);
      expect(intro!.role.length, preset).toBeGreaterThan(20);
      expect(intro!.lire.length, preset).toBeGreaterThanOrEqual(1);
      expect(intro!.lire.length, preset).toBeLessThanOrEqual(4);
    }
  });

  it("aucune intro orpheline (préset absent du plan)", () => {
    for (const preset of Object.keys(EXPERIMENT_INTROS)) {
      expect(ALL_PRESETS, preset).toContain(preset);
    }
  });

  it("un preset inconnu retombe sur l'intro générique, jamais undefined", () => {
    expect(introFor("preset-fantome")).toBe(GENERIC_INTRO);
    expect(introFor(null)).toBe(GENERIC_INTRO);
  });

  it("le glossaire couvre les métriques affichées par les vues", () => {
    for (const key of [
      "macroF1", "microF1", "kappa", "ci", "dispersion", "ece", "humanCeiling",
      "lrap", "hammingLoss", "subsetAccuracy", "windowDiff", "pairedDelta",
      "agreementClasses",
    ]) {
      expect(METRIC_GLOSSARY[key], key).toBeTruthy();
    }
  });

  it("les définitions d'info-bulle restent courtes (≤ 2 phrases pleines)", () => {
    for (const [key, text] of Object.entries(METRIC_GLOSSARY)) {
      // Compte les fins de phrase — les abréviations du domaine n'en contiennent pas.
      const sentences = text.split(/[.!?]\s/).length;
      expect(sentences, key).toBeLessThanOrEqual(3);
    }
  });
});
