/** Blocs thématiques du catalogue (`presetBlocks.ts`) — fonctions pures. */

import { describe, expect, it } from "vitest";

import { groupPresetsByTheme, presetChip, protocolRank } from "@/features/lab/presetBlocks";
import type { PresetCatalog } from "@/features/lab/types";

const CATALOG: PresetCatalog = {
  themes: [
    { id: "planchers", label: "Planchers" },
    { id: "representations", label: "Représentations" },
  ],
  recommendedOrder: ["baseline-fast", "embeddings-frozen", "position-only"],
  presets: [
    { id: "embeddings-frozen", label: "Embeddings", theme: "representations", config: {} },
    { id: "position-only", label: "Position", theme: "planchers", config: {} },
    { id: "baseline-fast", label: "Baseline", theme: "planchers", config: {} },
    { id: "sans-theme", label: "Orphelin", config: {} },
  ],
};

describe("groupPresetsByTheme", () => {
  it("regroupe dans l'ordre du registre, trie par protocole au sein d'un bloc", () => {
    const blocks = groupPresetsByTheme(CATALOG);
    expect(blocks.map((b) => b.theme.id)).toEqual(["planchers", "representations", "autres"]);
    expect(blocks[0]!.presets.map((p) => p.id)).toEqual(["baseline-fast", "position-only"]);
  });

  it("⭐ un preset sans thème tombe dans « Autres » — jamais perdu", () => {
    const blocks = groupPresetsByTheme(CATALOG);
    expect(blocks[2]!.presets.map((p) => p.id)).toEqual(["sans-theme"]);
  });

  it("un bloc sans preset n'apparaît pas", () => {
    const blocks = groupPresetsByTheme({
      ...CATALOG,
      themes: [...CATALOG.themes, { id: "vide", label: "Vide" }],
    });
    expect(blocks.some((b) => b.theme.id === "vide")).toBe(false);
  });
});

describe("protocolRank", () => {
  it("rang 1-based, null hors protocole", () => {
    expect(protocolRank("baseline-fast", CATALOG.recommendedOrder)).toBe(1);
    expect(protocolRank("position-only", CATALOG.recommendedOrder)).toBe(3);
    expect(protocolRank("inconnu", CATALOG.recommendedOrder)).toBeNull();
  });
});

describe("presetChip", () => {
  it("priorités : validé > en cours > échec > jamais lancé", () => {
    expect(presetChip(undefined)).toEqual({ label: "jamais lancé", tone: "muted" });
    expect(
      presetChip({ nRuns: 3, byStatus: { succeeded: 1, failed: 2 }, lastRunAt: null,
        experimentId: "e", validated: true }),
    ).toEqual({ label: "validé", tone: "success" });
    expect(
      presetChip({ nRuns: 2, byStatus: { running: 1, failed: 1 }, lastRunAt: null,
        experimentId: "e", validated: false }),
    ).toEqual({ label: "en cours", tone: "accent" });
    expect(
      presetChip({ nRuns: 1, byStatus: { failed: 1 }, lastRunAt: null,
        experimentId: "e", validated: false }),
    ).toEqual({ label: "échec", tone: "danger" });
  });

  it("⭐ un run cancelled seul n'est ni un échec ni un succès — « lancé » neutre", () => {
    expect(
      presetChip({ nRuns: 1, byStatus: { cancelled: 1 }, lastRunAt: null,
        experimentId: "e", validated: false }),
    ).toEqual({ label: "lancé", tone: "muted" });
  });
});
