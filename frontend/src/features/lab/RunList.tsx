"use client";

/**
 * File des runs, suivi, et comparaison.
 *
 * Point de conception : **« en file » n'est pas « en cours »**. Un job Grid'5000 peut
 * attendre des heures avant d'être alloué ; confondre les deux états ferait croire à un
 * blocage et pousserait à relancer inutilement un calcul déjà réservé.
 *
 * La comparaison REFUSE explicitement des runs dont les plis diffèrent (`comparable()`
 * côté serveur) — comparer deux modèles sur des découpages différents produit un écart
 * qui ne veut rien dire, et c'est une erreur silencieuse classique.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Ban, Clock, Loader2, TriangleAlert, XCircle, CheckCircle2, CircleDashed } from "lucide-react";
import Link from "next/link";

import { Button, Panel } from "@/components/ui/primitives";

import { RunComparisonFigure } from "./charts";
import { ComputeTargetBadge } from "./ComputeTargetBadge";
import { cancelRun, compareRuns, listRuns } from "./api";
import type { RunStatus, RunSummary } from "./types";

const RESULTS_READY: RunStatus[] = ["succeeded", "partial", "failed"];
const COMPARABLE_STATUSES: RunStatus[] = ["succeeded", "partial"];

const STATUS_META: Record<
  RunStatus,
  { label: string; icon: typeof Clock; className: string; hint?: string }
> = {
  queued: { label: "en file", icon: CircleDashed, className: "text-ink-muted" },
  waiting: {
    label: "en attente d'allocation",
    icon: Clock,
    className: "text-warning",
    hint: "réservé sur Grid'5000, en attente d'un nœud",
  },
  running: { label: "en cours", icon: Loader2, className: "text-accent" },
  succeeded: { label: "terminé", icon: CheckCircle2, className: "text-success" },
  partial: {
    label: "partiel",
    icon: TriangleAlert,
    className: "text-warning",
    hint: "walltime atteint — les plis calculés sont conservés",
  },
  failed: { label: "échec", icon: XCircle, className: "text-danger" },
  cancelled: { label: "annulé", icon: Ban, className: "text-ink-muted" },
};

const ACTIVE: RunStatus[] = ["queued", "waiting", "running"];

interface ComparisonState {
  comparable: boolean;
  incomparableReason: string | null;
  rows: Array<{ runId: string; label: string; value: number | null; humanCeiling: number | null }>;
}

export function RunList({ slug }: { slug: string }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [comparison, setComparison] = useState<ComparisonState | null>(null);
  const [comparing, setComparing] = useState(false);

  const refresh = useCallback(() => {
    listRuns(slug)
      .then(setRuns)
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, [slug]);

  // Dernière valeur de `runs`, lue par l'intervalle SANS figurer dans ses dépendances :
  // `refresh()` met justement `runs` à jour, donc l'y mettre en dépendance créerait une
  // boucle (l'effet se redéclenche à chaque rafraîchissement réussi, qui en relance un
  // autre aussitôt) — c'est ce qu'un test avec un mock à usage unique a révélé.
  const runsRef = useRef<RunSummary[]>([]);
  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    // Sondage seulement s'il reste quelque chose à suivre : inutile d'interroger le
    // serveur toutes les cinq secondes quand tous les runs sont terminés.
    const timer = setInterval(() => {
      if (runsRef.current.some((run) => ACTIVE.includes(run.status))) refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const toggle = (runId: string) => {
    setComparison(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  const runComparison = async () => {
    setComparing(true);
    try {
      const result = await compareRuns(slug, [...selected]);
      setComparison(result);
    } finally {
      setComparing(false);
    }
  };

  if (loading) {
    return (
      <Panel className="p-4">
        <p className="text-xs text-ink-muted">Chargement des expériences…</p>
      </Panel>
    );
  }

  if (runs.length === 0) {
    return (
      <Panel className="p-4" data-testid="runs-empty">
        <p className="text-xs text-ink-muted">
          Aucune expérience lancée. Construisez d&apos;abord un jeu de données (onglet
          « Jeux de données »), puis utilisez « Nouvelle expérience » ci-dessus.
        </p>
      </Panel>
    );
  }

  const humanCeiling = comparison?.rows.find((r) => r.humanCeiling != null)?.humanCeiling ?? null;

  return (
    <div className="space-y-4">
      <Panel className="p-4" data-testid="run-list">
        <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-ink-muted">
              <th scope="col" className="w-6 py-1" />
              <th scope="col" className="py-1 text-left">Expérience</th>
              <th scope="col" className="py-1 text-left">Tâche</th>
              <th scope="col" className="py-1 text-left">Cible</th>
              <th scope="col" className="py-1 text-left">État</th>
              <th scope="col" className="py-1 text-right">macro-F1</th>
              <th scope="col" className="py-1" />
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const meta = STATUS_META[run.status];
              const Icon = meta.icon;
              const selectable = COMPARABLE_STATUSES.includes(run.status);
              return (
                <tr key={run.id} className="border-t border-line" data-testid={`run-${run.id}`}>
                  <td className="py-1.5">
                    {selectable && (
                      <input
                        type="checkbox"
                        checked={selected.has(run.id)}
                        onChange={() => toggle(run.id)}
                        aria-label={`Sélectionner ${run.experimentName} pour comparaison`}
                        data-testid={`run-select-${run.id}`}
                      />
                    )}
                  </td>
                  <td className="py-1.5 text-ink">
                    {RESULTS_READY.includes(run.status) ? (
                      <Link
                        href={`/projects/${slug}/lab/runs/${run.id}`}
                        className="hover:underline"
                        data-testid={`run-link-${run.id}`}
                      >
                        {run.experimentName}
                      </Link>
                    ) : (
                      run.experimentName
                    )}
                  </td>
                  <td className="py-1.5 text-ink-muted">{run.task}</td>
                  <td className="py-1.5">
                    <ComputeTargetBadge target={run.computeTarget} site={run.computeSite} />
                  </td>
                  <td className="py-1.5">
                    <span className={`inline-flex items-center gap-1 ${meta.className}`}>
                      <Icon
                        className={
                          run.status === "running" ? "h-3 w-3 animate-spin" : "h-3 w-3"
                        }
                        aria-hidden
                      />
                      {meta.label}
                      {run.status === "running" && run.phase ? ` · ${run.phase}` : ""}
                    </span>
                    {run.status === "running" && (
                      <div
                        className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-panel-muted"
                        role="progressbar"
                        aria-valuenow={run.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Progression de ${run.experimentName}`}
                        data-testid={`run-progress-${run.id}`}
                      >
                        <div
                          className="h-full rounded-full bg-accent transition-[width]"
                          style={{ width: `${run.progress}%` }}
                        />
                      </div>
                    )}
                    {meta.hint && (
                      <span className="block text-xs text-ink-muted">{meta.hint}</span>
                    )}
                    {run.status === "failed" && run.errorCode && (
                      <span className="block text-xs text-danger">{run.errorCode}</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-mono text-ink">
                    {run.macroF1 == null ? "—" : run.macroF1.toFixed(3)}
                  </td>
                  <td className="py-1.5 text-right">
                    {ACTIVE.includes(run.status) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cancelRun(slug, run.id).then(refresh)}
                        title="Annuler ce run"
                      >
                        Annuler
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          <Button
            size="sm"
            disabled={selected.size < 2}
            loading={comparing}
            onClick={runComparison}
            title={
              selected.size < 2
                ? "Sélectionnez au moins deux runs terminés"
                : "Comparer les runs sélectionnés"
            }
            data-testid="run-compare-button"
          >
            Comparer ({selected.size})
          </Button>
        </div>
      </Panel>

      {comparison && !comparison.comparable && (
        <Panel
          className="border-danger/50 p-4 text-sm text-danger"
          data-testid="run-compare-refused"
        >
          Comparaison refusée : {comparison.incomparableReason}
        </Panel>
      )}
      {comparison?.comparable && (
        <RunComparisonFigure
          rows={comparison.rows.map((row) => ({
            runId: row.runId,
            label: row.label,
            value: row.value,
          }))}
          humanCeiling={humanCeiling}
        />
      )}
    </div>
  );
}
