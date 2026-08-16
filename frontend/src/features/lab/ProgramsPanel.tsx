"use client";

/**
 * Programmes d'expériences — les BLOCS CIBLÉS au service des publications
 * (docs/pactiva-lab/05_BLOCS_ET_PROGRAMMES.md). Une carte par programme (papier long,
 * papier court) : objectif, progression, et pour chaque item son rôle dans le papier,
 * son avancement RÉEL (dérivé des runs, jamais un état stocké) et l'action juste —
 * lancer ce qui manque, ouvrir les résultats de ce qui existe.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Play } from "lucide-react";
import Link from "next/link";

import { Badge, Button, Panel, ProgressBar } from "@/components/ui/primitives";

import { getPrograms, listDatasets, listPresets } from "./api";
import { PAPER_LABELS, presetChip } from "./presetBlocks";
import type { PresetStatus } from "./types";

const CHIP_CLASSES: Record<string, string> = {
  success: "border-success/50 text-success",
  accent: "border-accent/50 text-accent",
  danger: "border-danger/50 text-danger",
  muted: "border-line text-ink-muted",
};

function StatusChip({ status }: { status: PresetStatus | undefined }) {
  const chip = presetChip(status);
  return <Badge className={CHIP_CLASSES[chip.tone]}>{chip.label}</Badge>;
}

export function ProgramsPanel({
  slug,
  onLaunchPreset,
}: {
  slug: string;
  /** « Lancer » ouvre le lanceur pré-armé sur ce preset (onglet Expériences). */
  onLaunchPreset: (presetId: string) => void;
}) {
  const { data: datasets } = useQuery({
    queryKey: ["lab", "datasets", slug],
    queryFn: () => listDatasets(slug),
  });
  const [datasetId, setDatasetId] = useState<string>("");
  const effectiveDataset = datasetId || datasets?.[0]?.id || "";

  const { data, isPending, isError } = useQuery({
    queryKey: ["lab", "programs", slug, effectiveDataset],
    queryFn: () => getPrograms(slug, effectiveDataset || undefined),
  });
  const { data: catalog } = useQuery({
    queryKey: ["lab", "presets", slug],
    queryFn: () => listPresets(slug),
  });

  const presetLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const preset of catalog?.presets ?? []) map[preset.id] = preset.label;
    return map;
  }, [catalog]);

  if (isError) {
    return (
      <Panel className="p-4 text-sm text-danger" data-testid="programs-error">
        Impossible de charger les programmes.
      </Panel>
    );
  }
  if (isPending || !data) {
    return (
      <Panel className="p-4 text-xs text-ink-muted" data-testid="programs-loading">
        Chargement des programmes…
      </Panel>
    );
  }

  return (
    <div className="space-y-4" data-testid="programs-panel">
      <Panel className="flex flex-wrap items-center gap-3 p-3">
        <BookOpen className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
        <p className="text-xs text-ink-muted">
          L&apos;avancement est dérivé des <span className="text-ink">runs réels</span> sur
          le jeu de données choisi — jamais d&apos;un état séparé.
        </p>
        <label className="ml-auto flex items-center gap-2 text-xs text-ink-muted">
          Jeu de données
          <select
            value={effectiveDataset}
            onChange={(e) => setDatasetId(e.target.value)}
            className="rounded border border-line bg-panel-muted px-2 py-1 text-xs text-ink"
            data-testid="programs-dataset-select"
          >
            {(datasets ?? []).map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.label || dataset.fingerprint.slice(0, 12)} · {dataset.nDocuments} docs
              </option>
            ))}
          </select>
        </label>
      </Panel>

      {data.programs.map((program) => {
        const validated = program.items.filter(
          (item) => data.presetStatus[item.preset]?.validated,
        ).length;
        return (
          <Panel key={program.id} className="p-4" data-testid={`program-${program.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  {program.label}
                  <Badge className="border-accent/50 text-accent">
                    {PAPER_LABELS[program.paper] ?? program.paper}
                  </Badge>
                </h3>
                <p className="mt-1 max-w-2xl text-xs text-ink-muted">{program.goal}</p>
              </div>
              <div className="text-right">
                <p
                  className="text-xs font-medium text-ink"
                  data-testid={`program-progress-${program.id}`}
                >
                  {validated}/{program.items.length} validés
                </p>
                <ProgressBar
                  value={(validated / Math.max(1, program.items.length)) * 100}
                  label={`Avancement de ${program.label}`}
                  className="mt-1 w-32"
                />
              </div>
            </div>

            <ol className="mt-3 space-y-1.5">
              {program.items.map((item, index) => {
                const status = data.presetStatus[item.preset];
                return (
                  <li
                    key={item.preset}
                    className="flex flex-wrap items-center gap-2 rounded border border-line p-2 text-xs"
                    data-testid={`program-item-${program.id}-${item.preset}`}
                  >
                    <span className="w-5 shrink-0 text-right font-mono text-ink-muted">
                      {index + 1}.
                    </span>
                    <span className="font-medium text-ink">
                      {presetLabels[item.preset] ?? item.preset}
                    </span>
                    <StatusChip status={status} />
                    <span className="basis-full text-ink-muted sm:basis-auto">
                      {item.role}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                      {status?.experimentId && (
                        <Link
                          href={`/projects/${slug}/lab/experiments/${status.experimentId}`}
                          className="text-accent hover:underline"
                          data-testid={`program-results-${program.id}-${item.preset}`}
                        >
                          Résultats
                        </Link>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Play className="h-3 w-3" aria-hidden />}
                        onClick={() => onLaunchPreset(item.preset)}
                        title={`Lancer ${presetLabels[item.preset] ?? item.preset}`}
                        data-testid={`program-launch-${program.id}-${item.preset}`}
                      >
                        Lancer
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Panel>
        );
      })}
    </div>
  );
}
