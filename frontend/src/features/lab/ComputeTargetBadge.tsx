"use client";

/**
 * Indicateur de cible de calcul — Local vs Grid'5000.
 *
 * Absent partout avant ce correctif (audit UI Lab, docs/pactiva-lab-ui/01_AUDIT.md,
 * suite « ya des chemins dédiés ? » du 14 août 2026) : ni la liste des presets, ni la
 * liste des runs, ni le détail d'un run n'affichaient explicitement où une expérience
 * s'exécute — seulement déductible d'un texte libre (« ~45 min GPU ») ou, une fois
 * lancé, du statut transitoire « en attente d'allocation ». Un seul composant partagé
 * ici plutôt qu'un badge réinventé à chaque usage : la cible reste identifiable au même
 * coup d'œil (icône + libellé + site) partout où elle apparaît.
 */

import { Cpu, Server } from "lucide-react";
import type { ComputeTargetKind } from "./types";

export function computeTargetLabel(target: ComputeTargetKind, site?: string | null): string {
  if (target !== "g5k") return "Local";
  return site ? `Grid'5000 · ${site}` : "Grid'5000";
}

export function ComputeTargetBadge({
  target,
  site,
  className = "",
}: {
  target: ComputeTargetKind;
  site?: string | null;
  className?: string;
}) {
  const Icon = target === "g5k" ? Server : Cpu;
  const tone = target === "g5k" ? "text-accent" : "text-ink-muted";
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-xs ${tone} ${className}`}
      data-testid="compute-target-badge"
      title={
        target === "g5k"
          ? "S'exécute sur Grid'5000 (réservation distante)"
          : "S'exécute localement, sur le VPS"
      }
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {computeTargetLabel(target, site)}
    </span>
  );
}
