"use client";

/**
 * Résultats d'un run — le tableau principal, plafond humain sur la même échelle,
 * puis les figures F6/F8/F10.
 *
 * Principe tenu partout ici : aucune figure ne calcule ses propres chiffres, tout vient
 * de `run.metrics`, exactement ce que le runner a écrit dans `results.json`.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Badge, Panel } from "@/components/ui/primitives";

import { CalibrationFigure, ConfusionMatrixFigure, LabelScoreFigure } from "./charts";
import { ComputeTargetBadge } from "./ComputeTargetBadge";
import { getRun } from "./api";
import type { RunDetail } from "./types";

function fmt(value: number | null | undefined, digits = 3): string {
  return value == null ? "—" : value.toFixed(digits);
}

export function RunResults({ slug, runId }: { slug: string; runId: string }) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRun(slug, runId)
      .then((data) => {
        if (!cancelled) setRun(data);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger ce run.");
      });
    return () => {
      cancelled = true;
    };
  }, [slug, runId]);

  if (error) {
    return (
      <Panel className="p-4 text-sm text-danger" data-testid="run-results-error">
        {error}
      </Panel>
    );
  }
  if (!run) {
    return (
      <Panel className="p-4 text-xs text-ink-muted" data-testid="run-results-loading">
        Chargement…
      </Panel>
    );
  }

  const metrics = run.metrics?.metrics ?? {};
  const ceiling = run.metrics?.humanCeiling;
  const perLabel = run.metrics?.perLabel ?? [];
  const errors = run.metrics?.errors as
    | { confusionMatrix?: { labels: string[]; matrix: number[][] } }
    | undefined;
  const reliabilityCurve = (metrics.reliabilityCurve as unknown as Array<{
    bin: number;
    meanConfidence: number;
    accuracy: number;
    count: number;
  }>) || [];
  const ece = typeof metrics.ece === "number" ? metrics.ece : null;

  if (run.status !== "succeeded" && run.status !== "partial") {
    return (
      <Panel className="p-4" data-testid="run-results-not-ready">
        <p className="text-sm text-ink">
          Ce run est {run.status === "failed" ? "en échec" : "encore en cours"}.
        </p>
        {run.status === "failed" && (
          <p className="mt-1 text-xs text-danger">{run.errorDetail || run.errorCode}</p>
        )}
      </Panel>
    );
  }

  return (
    <div className="space-y-4" data-testid="run-results">
      <Link
        href={`/projects/${slug}/lab`}
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Retour au Lab
      </Link>

      <Panel className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">{run.experimentName}</h2>
            <p className="text-xs text-ink-muted">
              {run.task} · {run.metrics?.preprocess ?? ""}
            </p>
            {run.externalJobId && (
              <p className="text-xs text-ink-muted" data-testid="run-external-job-id">
                Job OAR : <span className="font-mono">{run.externalJobId}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ComputeTargetBadge target={run.computeTarget} site={run.computeSite} />
            {run.status === "partial" && (
              <Badge className="border-warning/50 text-warning">
                <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden />
                résultats partiels (walltime)
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="run-metrics-kpis">
          <MetricCell label="macro-F1" value={fmt(metrics.macroF1 as number)} />
          <MetricCell label="micro-F1" value={fmt(metrics.microF1 as number)} />
          <MetricCell
            label="plafond humain"
            value={ceiling?.value != null ? fmt(ceiling.value) : "—"}
            hint={ceiling?.metric}
          />
          <MetricCell label="ECE" value={ece != null ? fmt(ece) : "—"} />
        </div>
        {ceiling?.note && <p className="mt-2 text-xs text-ink-muted">{ceiling.note}</p>}
      </Panel>

      {perLabel.length > 0 && <LabelScoreFigure rows={perLabel} />}
      {errors?.confusionMatrix && <ConfusionMatrixFigure matrix={errors.confusionMatrix} />}
      {reliabilityCurve.length > 0 && (
        <CalibrationFigure buckets={reliabilityCurve} ece={ece} />
      )}

      {run.metrics?.perFold && run.metrics.perFold.length > 0 && (
        <Panel className="overflow-hidden" data-testid="run-per-fold">
          <div className="border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">Détail par pli</h3>
            <p className="text-xs text-ink-muted">
              La dispersion entre plis compte autant que la moyenne sur un petit corpus.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ink-muted">
                  <th scope="col" className="px-3 py-1 text-left">
                    Pli
                  </th>
                  {Object.keys(run.metrics.perFold[0] ?? {}).map((key) => (
                    <th key={key} scope="col" className="px-3 py-1 text-right">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {run.metrics.perFold.map((fold, index) => (
                  <tr key={index} className="border-t border-line">
                    <td className="px-3 py-1 text-ink">{index}</td>
                    {Object.values(fold).map((value, i) => (
                      <td key={i} className="px-3 py-1 text-right font-mono text-ink">
                        {typeof value === "number" ? value.toFixed(3) : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

function MetricCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-lg font-semibold text-ink">{value}</dd>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
