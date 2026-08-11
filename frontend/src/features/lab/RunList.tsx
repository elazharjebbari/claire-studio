"use client";

/**
 * File des runs et suivi.
 *
 * Point de conception : **« en file » n'est pas « en cours »**. Un job Grid'5000 peut
 * attendre des heures avant d'être alloué ; confondre les deux états ferait croire à un
 * blocage et pousserait à relancer inutilement un calcul déjà réservé.
 */

import { useCallback, useEffect, useState } from "react";
import { Ban, Clock, Loader2, TriangleAlert, XCircle, CheckCircle2, CircleDashed } from "lucide-react";

import { Button, Panel } from "@/components/ui/primitives";

import { cancelRun, listRuns } from "./api";
import type { RunStatus, RunSummary } from "./types";

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

export function RunList({ slug }: { slug: string }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    listRuns(slug)
      .then(setRuns)
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    refresh();
    // Sondage seulement s'il reste quelque chose à suivre : inutile d'interroger le
    // serveur toutes les cinq secondes quand tous les runs sont terminés.
    const timer = setInterval(() => {
      if (runs.some((run) => ACTIVE.includes(run.status))) refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [refresh, runs]);

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
          Aucune expérience lancée. Construisez d&apos;abord un jeu de données, puis
          lancez un preset depuis la ligne de commande ou l&apos;API.
        </p>
      </Panel>
    );
  }

  return (
    <Panel className="p-4" data-testid="run-list">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-ink-muted">
            <th scope="col" className="py-1 text-left">Expérience</th>
            <th scope="col" className="py-1 text-left">Tâche</th>
            <th scope="col" className="py-1 text-left">État</th>
            <th scope="col" className="py-1 text-right">macro-F1</th>
            <th scope="col" className="py-1" />
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const meta = STATUS_META[run.status];
            const Icon = meta.icon;
            return (
              <tr key={run.id} className="border-t border-line" data-testid={`run-${run.id}`}>
                <td className="py-1.5 text-ink">{run.experimentName}</td>
                <td className="py-1.5 text-ink-muted">{run.task}</td>
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
                  {meta.hint && (
                    <span className="block text-[10px] text-ink-muted">{meta.hint}</span>
                  )}
                  {run.status === "failed" && run.errorCode && (
                    <span className="block text-[10px] text-danger">{run.errorCode}</span>
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
    </Panel>
  );
}
