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
import { useMutation } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button, Panel, ProgressBar } from "@/components/ui/primitives";

import { RunComparisonFigure } from "./charts";
import { ComputeTargetBadge } from "./ComputeTargetBadge";
import { cancelRun, compareRuns, listRuns } from "./api";
import { groupRuns } from "./runGroups";
import { ACTIVE, COMPARABLE_STATUSES, LIVE, STATUS_META, elapsedLabel, isProgressLive } from "./runStatus";
import type { RunSummary } from "./types";

interface ComparisonState {
  comparable: boolean;
  incomparableReason: string | null;
  rows: Array<{
    runId: string;
    label: string;
    value: number | null;
    ci: { low: number | null; high: number | null } | null;
    humanCeiling: number | null;
  }>;
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

  // `useMutation` plutôt qu'un `.then()` brut : la queue d'erreurs globale
  // (`store/apiErrors.ts` + `ApiErrorBanner`) capte automatiquement un échec réseau/API
  // sur l'annulation — auparavant totalement silencieux (audit UI/UX, 15 août 2026).
  //
  // L'état de chargement par ligne vient d'un `Set` local, PAS de
  // `cancelMutation.variables` : une seule instance de mutation est partagée par toutes
  // les lignes du tableau, donc `variables` ne reflète que le DERNIER appel — deux
  // annulations rapprochées sur des runs différents feraient réapparaître le bouton
  // « Annuler » de la première alors que sa requête est encore en vol (revue
  // adversariale du 15 août 2026, trouvé indépendamment par les deux réviseurs).
  const [pendingCancels, setPendingCancels] = useState<Set<string>>(new Set());
  // Groupes de sweep dépliés — repliés par défaut : un criblage de 48 runs se lit
  // d'abord par sa ligne d'agrégat et sa vue d'ensemble, pas par ses lignes brutes.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const cancelMutation = useMutation({
    mutationFn: (runId: string) => cancelRun(slug, runId),
    onMutate: (runId: string) => {
      setPendingCancels((prev) => new Set(prev).add(runId));
    },
    onSuccess: refresh,
    onSettled: (_data, _error, runId) => {
      setPendingCancels((prev) => {
        const next = new Set(prev);
        next.delete(runId);
        return next;
      });
    },
  });

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

  function runRow(run: RunSummary) {
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
                    {/* Cliquable pour TOUT statut, y compris en cours — auparavant
                     * impossible d'ouvrir le détail d'un run non terminé, alors que ce
                     * détail affiche désormais un suivi vivant (audit du 15 août 2026). */}
                    <Link
                      href={`/projects/${slug}/lab/runs/${run.id}`}
                      className="hover:underline"
                      data-testid={`run-link-${run.id}`}
                    >
                      {run.experimentName}
                    </Link>
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
                      {LIVE.includes(run.status) && run.phase ? ` · ${run.phase}` : ""}
                    </span>
                    {LIVE.includes(run.status) && (
                      <>
                        <ProgressBar
                          value={run.progress}
                          indeterminate={!isProgressLive(run.computeTarget, run.progress)}
                          label={`Progression de ${run.experimentName}`}
                          className="mt-1"
                          testId={`run-progress-${run.id}`}
                          describedBy={`run-elapsed-${run.id}`}
                        />
                        <span
                          id={`run-elapsed-${run.id}`}
                          className="block text-xs text-ink-muted"
                          data-testid={`run-elapsed-${run.id}`}
                        >
                          depuis {elapsedLabel(run.startedAt ?? run.createdAt, Date.now()) ?? "…"}
                        </span>
                      </>
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
                    {ACTIVE.includes(run.status) &&
                      (run.cancelRequested ? (
                        // Annulation déjà acceptée côté serveur (le drapeau est posé de
                        // manière synchrone par `POST .../cancel`, avant même que
                        // `status` ne bascule sur `cancelled`) — jamais un bouton
                        // recliquable pendant cette fenêtre, sans quoi un second appel
                        // redondant part sans que rien n'ait vraiment changé.
                        <span
                          className="text-xs text-ink-muted"
                          data-testid={`run-cancel-pending-${run.id}`}
                        >
                          annulation en cours…
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={pendingCancels.has(run.id)}
                          onClick={() => {
                            const warning =
                              run.computeTarget === "g5k"
                                ? " La réservation Grid'5000 sera libérée."
                                : "";
                            if (window.confirm(`Annuler « ${run.experimentName} » ?${warning}`)) {
                              cancelMutation.mutate(run.id);
                            }
                          }}
                          title="Annuler ce run"
                          data-testid={`run-cancel-${run.id}`}
                        >
                          Annuler
                        </Button>
                      ))}
                  </td>
                </tr>
    );
  }

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
            {groupRuns(runs).flatMap((group) => {
              if (group.runs.length === 1) return [runRow(group.runs[0]!)];
              const open = expandedGroups.has(group.experimentId);
              const header = (
                <tr
                  key={`group-${group.experimentId}`}
                  className="border-t border-line"
                  data-testid={`run-group-${group.experimentId}`}
                >
                  <td className="py-1.5">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={`${open ? "Replier" : "Déplier"} les runs de ${group.experimentName}`}
                      onClick={() =>
                        setExpandedGroups((current) => {
                          const next = new Set(current);
                          if (next.has(group.experimentId)) next.delete(group.experimentId);
                          else next.add(group.experimentId);
                          return next;
                        })
                      }
                      className="rounded p-0.5 text-ink-muted hover:bg-panel-muted hover:text-ink"
                      data-testid={`run-group-toggle-${group.experimentId}`}
                    >
                      <ChevronRight
                        className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
                        aria-hidden
                      />
                    </button>
                  </td>
                  <td className="py-1.5 text-ink" colSpan={3}>
                    <Link
                      href={`/projects/${slug}/lab/experiments/${group.experimentId}`}
                      className="font-medium hover:underline"
                      data-testid={`run-group-link-${group.experimentId}`}
                    >
                      {group.experimentName}
                    </Link>{" "}
                    <span className="text-ink-muted">
                      · {group.runs.length} runs — vue d&apos;ensemble
                    </span>
                  </td>
                  <td className="py-1.5 text-ink-muted">
                    {group.activeCount > 0 ? `${group.activeCount} actif(s) · ` : ""}
                    {group.failedCount > 0 ? `${group.failedCount} échec(s) · ` : ""}
                    {group.runs.length - group.activeCount - group.failedCount} terminé(s)
                  </td>
                  <td className="py-1.5 text-right font-mono text-ink">
                    {group.bestMacroF1 == null ? "—" : group.bestMacroF1.toFixed(3)}
                    <span className="ml-1 text-ink-muted">(meilleur)</span>
                  </td>
                  <td className="py-1.5" />
                </tr>
              );
              return open ? [header, ...group.runs.map(runRow)] : [header];
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
            // L'IC bootstrap était renvoyé par le serveur depuis toujours, et jeté
            // ici — la figure sait le tracer (audit 01_AUDIT.md §2, « un résultat
            // sans IC ne va pas dans l'article »).
            ci: row.ci ?? null,
          }))}
          humanCeiling={humanCeiling}
        />
      )}
    </div>
  );
}
