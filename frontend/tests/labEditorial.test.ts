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
  // Expériences des papiers (docs/pactiva-experiences-papiers/02) : mesures + graphe.
  "iaa-mesure", "gold-cascade", "cooccurrence-abusivite", "cooccurrence-deontique",
  "cooccurrence-bruit",
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
  const push = (label: string, intro: (typeof GENERIC_INTRO)) => {
    out.push([`${label}.pourquoi`, intro.pourquoi]);
    out.push([`${label}.teste`, intro.teste]);
    out.push([`${label}.role`, intro.role]);
    intro.lire.forEach((line, i) => out.push([`${label}.lire[${i}]`, line]));
    intro.metriques.forEach((note, i) => {
      out.push([`${label}.metriques[${i}].nom`, note.nom]);
      out.push([`${label}.metriques[${i}].sens`, note.sens]);
      out.push([`${label}.metriques[${i}].lecture`, note.lecture]);
    });
  };
  for (const [preset, intro] of Object.entries(EXPERIMENT_INTROS)) push(preset, intro);
  push("generic", GENERIC_INTRO);
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

  it("⭐ chaque preset a une introduction complète (pourquoi / teste / rôle / lire / métriques)", () => {
    for (const preset of ALL_PRESETS) {
      const intro = EXPERIMENT_INTROS[preset];
      expect(intro, preset).toBeDefined();
      expect(intro!.pourquoi.length, preset).toBeGreaterThan(80);
      expect(intro!.teste.length, preset).toBeGreaterThan(40);
      expect(intro!.role.length, preset).toBeGreaterThan(20);
      expect(intro!.lire.length, preset).toBeGreaterThanOrEqual(1);
      expect(intro!.lire.length, preset).toBeLessThanOrEqual(4);
    }
  });

  it("⭐ chaque métrique documentée porte un nom, un sens et une lecture substantiels", () => {
    const entries: Array<[string, (typeof GENERIC_INTRO)]> = [
      ...Object.entries(EXPERIMENT_INTROS),
      ["generic", GENERIC_INTRO],
    ];
    for (const [preset, intro] of entries) {
      // ≥ 3 notions par page : une page de résultats montre toujours au moins un
      // score, son incertitude et une référence.
      expect(intro.metriques.length, preset).toBeGreaterThanOrEqual(3);
      const noms = intro.metriques.map((m) => m.nom);
      expect(new Set(noms).size, `${preset} : doublon de métrique`).toBe(noms.length);
      for (const note of intro.metriques) {
        expect(note.nom.length, `${preset}/${note.nom}`).toBeGreaterThan(1);
        // Le « sens » est une définition, la « lecture » une consigne concrète —
        // ni l'un ni l'autre ne peut être un fragment de trois mots.
        expect(note.sens.length, `${preset}/${note.nom}.sens`).toBeGreaterThan(40);
        expect(note.lecture.length, `${preset}/${note.nom}.lecture`).toBeGreaterThan(40);
      }
    }
  });

  it("les notions transverses (IC, dispersion, plafond, Δ) gardent UNE définition unique", () => {
    // Deux formulations divergentes de « IC 95 % » seraient un bug éditorial : la
    // définition partagée doit être STRICTEMENT identique partout où elle apparaît.
    const byName = new Map<string, Set<string>>();
    for (const intro of [...Object.values(EXPERIMENT_INTROS), GENERIC_INTRO]) {
      for (const note of intro.metriques) {
        if (!byName.has(note.nom)) byName.set(note.nom, new Set());
        byName.get(note.nom)!.add(`${note.sens}|${note.lecture}`);
      }
    }
    for (const shared of [
      "IC 95 % (bootstrap par document)",
      "Dispersion inter-plis (±)",
      "Plafond humain approximé",
      "Δ apparié [IC], p (permutation)",
    ]) {
      expect(byName.get(shared)?.size, shared).toBe(1);
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
      // Mesures d'accord (M1/M2) et détection (G2) — vues ad-hoc des papiers.
      "alphaMasi", "alphaNominal", "alphaDiff", "gwetAc1", "boundaryJaccard",
      "seedDivergence", "aucPr", "precisionAt", "lift", "npmi", "comboIdentity",
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
