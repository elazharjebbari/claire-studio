/**
 * Blocs thématiques du catalogue — fonctions PURES
 * (docs/pactiva-lab/05_BLOCS_ET_PROGRAMMES.md §3).
 */

import type { Preset, PresetCatalog, PresetStatus, PresetTheme } from "./types";

export interface PresetBlock {
  theme: PresetTheme;
  presets: Preset[];
}

/**
 * Regroupe les presets par bloc thématique, dans l'ordre du registre `themes` ; au
 * sein d'un bloc, l'ordre du protocole (`recommendedOrder`) prime. Un preset sans
 * thème (catalogue incomplet) tombe dans un bloc « Autres » final — jamais perdu.
 */
export function groupPresetsByTheme(catalog: PresetCatalog): PresetBlock[] {
  const order = catalog.recommendedOrder;
  const rank = (preset: Preset) => {
    const index = order.indexOf(preset.id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const sorted = [...catalog.presets].sort((a, b) => rank(a) - rank(b));

  const blocks: PresetBlock[] = [];
  for (const theme of catalog.themes ?? []) {
    const presets = sorted.filter((p) => p.theme === theme.id);
    if (presets.length > 0) blocks.push({ theme, presets });
  }
  const known = new Set((catalog.themes ?? []).map((t) => t.id));
  const orphans = sorted.filter((p) => !p.theme || !known.has(p.theme));
  if (orphans.length > 0) {
    blocks.push({
      theme: { id: "autres", label: "Autres", description: undefined },
      presets: orphans,
    });
  }
  return blocks;
}

/** Rang (1-based) du preset dans le protocole recommandé, null s'il n'y figure pas. */
export function protocolRank(presetId: string, recommendedOrder: string[]): number | null {
  const index = recommendedOrder.indexOf(presetId);
  return index === -1 ? null : index + 1;
}

export type PresetChipTone = "success" | "accent" | "danger" | "muted";

export interface PresetChip {
  label: string;
  tone: PresetChipTone;
}

/**
 * Chip d'avancement d'un preset sur le dataset choisi — dérivée des runs réels.
 * Priorités : validé (≥1 succès) > en cours (runs actifs) > échec (que des échecs) >
 * jamais lancé.
 */
export function presetChip(status: PresetStatus | undefined): PresetChip {
  if (!status || status.nRuns === 0) return { label: "jamais lancé", tone: "muted" };
  if (status.validated) return { label: "validé", tone: "success" };
  const active = ["queued", "waiting", "running"].some(
    (key) => (status.byStatus[key] ?? 0) > 0,
  );
  if (active) return { label: "en cours", tone: "accent" };
  if ((status.byStatus["failed"] ?? 0) > 0) return { label: "échec", tone: "danger" };
  return { label: "lancé", tone: "muted" };
}

export const STAGE_LABELS: Record<string, string> = {
  reference: "référence",
  criblage: "criblage",
  confirmation: "confirmation",
  ablation: "ablation",
};

export const PAPER_LABELS: Record<string, string> = {
  long: "papier long",
  court: "papier court",
};
