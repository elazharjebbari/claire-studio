"use client";

/**
 * Résultats d'un run — le tableau principal, plafond humain sur la même échelle,
 * puis les figures F6/F8/F10.
 *
 * Principe tenu partout ici : aucune figure ne calcule ses propres chiffres, tout vient
 * de `run.metrics`, exactement ce que le runner a écrit dans `results.json`.
 */

import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Badge, Button, Panel, ProgressBar } from "@/components/ui/primitives";
import { Disclosure } from "@/components/ui/Disclosure";

import { CalibrationFigure, ConfusionMatrixFigure, LabelScoreFigure } from "./charts";
import { ComputeTargetBadge } from "./ComputeTargetBadge";
import { cancelRun, getRun } from "./api";
import { metricDefinition } from "./content/metricGlossary";
import {
  CeilingBand,
  ExperimentIntro,
  MetricCell,
  VerdictPanel,
} from "./resultComponents";
import { fmtCeilingShare, fmtCi, fmtMetric } from "./resultFormat";
import { ACTIVE, LIVE, STATUS_META, elapsedLabel, isProgressLive, isStaleHeartbeat } from "./runStatus";
import type { RunDetail, RunStatus } from "./types";

/**
 * Sondage adaptatif, même principe que `useExportJob` (`lib/api/hooks.ts`) : dense pour
 * un run LOCAL (`progress` réellement mis à jour toutes les 2 s par le worker), beaucoup
 * plus espacé pour Grid'5000 — chaque sonde y coûte deux requêtes HTTP côté client
 * officiel (`g5k_client.py`), et l'état OAR ne change de toute façon pas à la seconde.
 * Arrêt net dès un statut terminal.
 */
function pollIntervalMs(status: RunStatus | undefined, computeTarget: string | undefined): number | false {
  if (!status || !ACTIVE.includes(status)) return false;
  return computeTarget === "g5k" ? 20_000 : 2_000;
}

export function RunResults({ slug, runId }: { slug: string; runId: string }) {
  const { data: run, isPending, isError } = useQuery({
    queryKey: ["lab", "run", slug, runId],
    queryFn: () => getRun(slug, runId),
    refetchInterval: (query) => pollIntervalMs(query.state.data?.status, query.state.data?.computeTarget),
  });

  // Ne dépend d'aucune query cache invalidée ailleurs : `run` vient du MÊME `useQuery`
  // ci-dessus, qui se rafraîchit tout seul (`refetchInterval`) jusqu'à voir `cancelled`.
  const cancelMutation = useMutation({ mutationFn: () => cancelRun(slug, runId) });

  if (isError) {
    return (
      <Panel className="p-4 text-sm text-danger" data-testid="run-results-error">
        Impossible de charger ce run.
      </Panel>
    );
  }
  if (isPending || !run) {
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
    const meta = STATUS_META[run.status];
    const Icon = meta.icon;
    const now = Date.now();
    // `live` (progression/phase) est un sous-ensemble STRICT de `canCancel`
    // (annulable dès `queued`) — un run tout juste `queued` n'a rien à montrer en
    // progression mais reste annulable, exactement comme dans `RunList` (revue
    // adversariale du 15 août 2026 : ces deux notions étaient auparavant confondues
    // sous une seule variable, avec un rendu divergent de celui de `RunList` pour un
    // run `queued`).
    const live = LIVE.includes(run.status);
    const canCancel = ACTIVE.includes(run.status);
    const stale = live && isStaleHeartbeat(run.heartbeatAt, now);
    const elapsedId = "run-elapsed-detail";
    return (
      <Panel className="space-y-3 p-4" data-testid="run-results-not-ready">
        <Link
          href={`/projects/${slug}/lab?tab=runs`}
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Retour au Lab
        </Link>

        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">{run.experimentName}</h2>
            <p className="text-xs text-ink-muted">{run.task}</p>
          </div>
          <ComputeTargetBadge target={run.computeTarget} site={run.computeSite} />
        </div>

        <div className={`flex items-center gap-1.5 text-sm ${meta.className}`}>
          <Icon className={run.status === "running" ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
          {meta.label}
          {live && run.phase ? ` · ${run.phase}` : ""}
        </div>

        {live && (
          <div className="space-y-1.5" data-testid="run-live-tracking">
            <ProgressBar
              value={run.progress}
              indeterminate={!isProgressLive(run.computeTarget, run.progress)}
              label={`Progression de ${run.experimentName}`}
              className="w-full"
              testId="run-progress-detail"
              describedBy={elapsedId}
            />
            <p id={elapsedId} className="text-xs text-ink-muted" data-testid="run-elapsed-detail">
              depuis {elapsedLabel(run.startedAt ?? run.createdAt, now) ?? "…"}
            </p>
            {stale && (
              <p className="flex items-center gap-1 text-xs text-warning" data-testid="run-stale-heartbeat">
                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                Aucune activité détectée depuis {elapsedLabel(run.heartbeatAt, now)} — ce run pourrait
                être bloqué.
              </p>
            )}
          </div>
        )}

        {run.attempt > 1 && (
          // Un token `ink-muted` seul n'est pas assez contrasté pour porter une
          // information critique (harnais AA, `tests/contrastAA.test.ts`) — un run
          // repris après incident mérite le même traitement icône + token sémantique
          // que le battement périmé ci-dessus, pas un fragment noyé dans du texte gris
          // (revue adversariale du 15 août 2026).
          <p className="flex items-center gap-1 text-xs text-warning" data-testid="run-attempt-warning">
            <RotateCcw className="h-3 w-3 shrink-0" aria-hidden />
            Reprise après incident — tentative {run.attempt}
          </p>
        )}

        {canCancel &&
          (run.cancelRequested ? (
            <p className="text-xs text-ink-muted" data-testid="run-cancel-pending-detail">
              annulation en cours…
            </p>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              loading={cancelMutation.isPending}
              onClick={() => {
                const warning =
                  run.computeTarget === "g5k" ? " La réservation Grid'5000 sera libérée." : "";
                if (window.confirm(`Annuler « ${run.experimentName} » ?${warning}`)) {
                  cancelMutation.mutate();
                }
              }}
              title="Annuler ce run"
              data-testid="run-cancel-detail"
            >
              Annuler
            </Button>
          ))}

        {meta.hint && <p className="text-xs text-ink-muted">{meta.hint}</p>}
        {run.status === "failed" && (
          <p className="text-xs text-danger">{run.errorDetail || run.errorCode}</p>
        )}
        {run.status === "cancelled" && (
          <p className="text-xs text-ink-muted">Ce run a été annulé.</p>
        )}
      </Panel>
    );
  }

  const foldStats = metrics.foldStats ?? {};
  const kappa = typeof metrics.kappa === "number" ? metrics.kappa : null;
  const macroF1 = typeof metrics.macroF1 === "number" ? metrics.macroF1 : null;
  const ceilingShare = fmtCeilingShare(macroF1, ceiling?.value);
  const errorDetails = run.metrics?.errors;

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

        <div className="mt-3">
          <ExperimentIntro preset={run.preset} />
        </div>

        {macroF1 != null && ceilingShare && (
          <div className="mt-3">
            <VerdictPanel>
              macro-F1 {fmtMetric(macroF1)}
              {fmtCi(metrics.macroF1Ci) ? ` ${fmtCi(metrics.macroF1Ci)}` : ""} — soit{" "}
              {ceilingShare}.
            </VerdictPanel>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="run-metrics-kpis">
          <MetricCell
            label="macro-F1"
            value={macroF1}
            ci={metrics.macroF1Ci}
            dispersion={foldStats.macroF1?.std}
            definitionKey="macroF1"
            testId="kpi-macro-f1"
          />
          <MetricCell
            label="micro-F1"
            value={metrics.microF1 as number | null}
            dispersion={foldStats.microF1?.std}
            definitionKey="microF1"
            testId="kpi-micro-f1"
          />
          {kappa != null && (
            <MetricCell
              label="κ"
              value={kappa}
              dispersion={foldStats.kappa?.std}
              definitionKey="kappa"
              testId="kpi-kappa"
            />
          )}
          <MetricCell
            label="ECE"
            value={ece}
            definitionKey="ece"
            testId="kpi-ece"
          />
        </div>
        <div className="mt-3">
          <CeilingBand
            value={ceiling?.value}
            ci={ceiling?.ci}
            metric={ceiling?.metric}
            note={ceiling?.note}
          />
        </div>
      </Panel>

      {perLabel.length > 0 && <LabelScoreFigure rows={perLabel} />}
      {errors?.confusionMatrix && <ConfusionMatrixFigure matrix={errors.confusionMatrix} />}
      {reliabilityCurve.length > 0 && (
        <CalibrationFigure buckets={reliabilityCurve} ece={ece} />
      )}

      {errorDetails?.byAgreementClass && (
        <Disclosure
          summary="Analyse d'erreurs"
          badge={errorDetails.nErrors ?? null}
          testId="run-error-analysis"
        >
          <div className="space-y-3 text-xs">
            <div data-testid="errors-by-agreement">
              <h4 className="mb-1 font-medium text-ink">Erreurs par classe d&apos;accord</h4>
              <p className="mb-2 text-ink-muted">
                {metricDefinition("agreementClasses")}
              </p>
              <table className="w-full">
                <thead>
                  <tr className="text-ink-muted">
                    <th scope="col" className="py-1 text-left">Classe</th>
                    <th scope="col" className="py-1 text-right">Phrases</th>
                    <th scope="col" className="py-1 text-right">Erreurs</th>
                    <th scope="col" className="py-1 text-right">Taux</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(errorDetails.byAgreementClass).map(([klass, stats]) => (
                    <tr key={klass} className="border-t border-line">
                      <td className="py-1 text-ink">{klass}</td>
                      <td className="py-1 text-right font-mono text-ink">{stats.n}</td>
                      <td className="py-1 text-right font-mono text-ink">{stats.errors}</td>
                      <td className="py-1 text-right font-mono text-ink">
                        {stats.rate == null ? "—" : `${(stats.rate * 100).toFixed(1)} %`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {typeof errorDetails.unfairErrorRate === "number" && (
              <p className="text-ink-muted" data-testid="errors-unfair-rate">
                Taux d&apos;erreur sur les clauses abusives :{" "}
                <span className="font-mono text-ink">
                  {(errorDetails.unfairErrorRate * 100).toFixed(1)} %
                </span>{" "}
                ({errorDetails.unfairSentences} phrases abusives) — un modèle moins bon
                sur les clauses abusives serait un problème pratique majeur.
              </p>
            )}
            {(errorDetails.topConfusions?.length ?? 0) > 0 && (
              <div data-testid="errors-top-confusions">
                <h4 className="mb-1 font-medium text-ink">Paires les plus confondues</h4>
                <ul className="space-y-0.5 text-ink-muted">
                  {errorDetails.topConfusions!.slice(0, 10).map((row, i) => (
                    <li key={i}>
                      <span className="font-mono text-ink">{row.true}</span> prédit{" "}
                      <span className="font-mono text-ink">{row.pred}</span> ·{" "}
                      {row.count} fois
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Disclosure>
      )}

      {Object.keys(run.environment ?? {}).length > 0 && (
        <Disclosure summary="Environnement & reproductibilité" testId="run-environment">
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            {Object.entries(flattenEnvironment(run.environment)).map(([key, value]) => (
              <div key={key}>
                <dt className="uppercase tracking-wide text-ink-muted">{key}</dt>
                <dd className="font-mono text-ink">{value}</dd>
              </div>
            ))}
            {run.metrics?.dataset?.fingerprint && (
              <div>
                <dt className="uppercase tracking-wide text-ink-muted">dataset</dt>
                <dd className="font-mono text-ink">
                  {String(run.metrics.dataset.fingerprint).slice(0, 12)}… ·{" "}
                  {run.metrics.dataset.nDocuments} docs
                </dd>
              </div>
            )}
          </dl>
        </Disclosure>
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

/** Aplatis l'empreinte d'environnement en paires courtes affichables. */
function flattenEnvironment(environment: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const gpu = environment.gpu as { device?: string | null; available?: boolean } | undefined;
  if (gpu) out.gpu = gpu.available ? String(gpu.device ?? "disponible") : "aucun (CPU)";
  if (typeof environment.python === "string") out.python = environment.python;
  const packages = environment.packages as Record<string, string> | undefined;
  if (packages?.torch) out.torch = packages.torch;
  if (packages?.["scikit-learn"]) out["scikit-learn"] = packages["scikit-learn"];
  if (typeof environment.elapsedSeconds === "number") {
    out["durée"] = `${Math.round(environment.elapsedSeconds)} s`;
  }
  return out;
}
