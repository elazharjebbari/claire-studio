"use client";

/**
 * Vue AGRÉGÉE d'une expérience (sweep) — familles C (comparaison appariée),
 * D (criblage), E (courbe), F (juges LLM) du dossier 04 §4. Sans elle, 25 à 48 runs
 * restent une liste plate : la question décisionnelle du preset (quel axe survit ?
 * combien annoter ? le fine-tuning gagne-t-il ?) n'a de réponse qu'au niveau du sweep.
 */

import { ArrowLeft, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Panel } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api/client";

import {
  comparePaired,
  getExperimentAggregate,
  getJudgesAgreement,
  type AggregateRun,
  type ExperimentAggregate,
} from "./api";
import { RunComparisonFigure } from "./charts";
import { ExperimentIntro, SignificanceNote, VerdictPanel } from "./resultComponents";
import { fmtCi, fmtMetric } from "./resultFormat";
import { resultViewFor, type ViewFamily } from "./resultView";
import {
  marginalAxisEffects,
  survivalSet,
  variantLabel,
  fitPowerLaw,
  powerLawValue,
  extrapolationLimit,
  type SweepPoint,
} from "./sweepAnalysis";
import { LearningCurveFigure, type CurveGroup } from "./sweepCharts";

/** Sous ce seuil d'ampleur (max−min des moyennes marginales), un axe est déclaré
 * « négligeable au criblage » — seuil EXPLORATOIRE, dit tel quel dans l'UI. */
const EXPLORATORY_EFFECT_FLOOR = 0.005;

const DONE = new Set(["succeeded", "partial"]);

export function ExperimentResults({
  slug,
  experimentId,
}: {
  slug: string;
  experimentId: string;
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["lab", "aggregate", slug, experimentId],
    queryFn: () => getExperimentAggregate(slug, experimentId),
  });
  const family: ViewFamily = data
    ? resultViewFor({ preset: data.preset, task: "T1_primary" })
    : "generic";
  const isJudges = family === "judges";

  // Les juges se comparent en κ (l'unité de la fig. F9) — pas en macro-F1.
  const { data: kappaData } = useQuery({
    queryKey: ["lab", "aggregate-kappa", slug, experimentId],
    queryFn: () => getExperimentAggregate(slug, experimentId, "kappa"),
    enabled: isJudges,
  });

  if (isError) {
    return (
      <Panel className="p-4 text-sm text-danger" data-testid="experiment-results-error">
        Impossible de charger cette expérience.
      </Panel>
    );
  }
  if (isPending || !data) {
    return (
      <Panel className="p-4 text-xs text-ink-muted" data-testid="experiment-results-loading">
        Chargement…
      </Panel>
    );
  }

  const finished = data.runs.filter((run) => DONE.has(run.status) && run.value != null);
  const pendingCount = data.runs.filter((run) => !DONE.has(run.status) && run.status !== "failed").length;
  const failedCount = data.runs.filter((run) => run.status === "failed").length;

  return (
    <div className="space-y-4" data-testid="experiment-results">
      <Link
        href={`/projects/${slug}/lab?tab=runs`}
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Retour au Lab
      </Link>

      <Panel className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">{data.name}</h2>
          <p className="text-xs text-ink-muted">
            {data.runs.length} runs · {finished.length} exploitables
            {failedCount > 0 ? ` · ${failedCount} en échec` : ""}
          </p>
        </div>
        <ExperimentIntro preset={data.preset} />
        {(pendingCount > 0 || failedCount > 0) && (
          <p
            className="flex items-center gap-1 text-xs text-warning"
            data-testid="sweep-incomplete"
          >
            <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden />
            Sweep incomplet : {pendingCount > 0 ? `${pendingCount} run(s) encore en cours` : ""}
            {pendingCount > 0 && failedCount > 0 ? ", " : ""}
            {failedCount > 0 ? `${failedCount} en échec (exclus des analyses)` : ""} — les
            figures portent sur les runs exploitables.
          </p>
        )}
      </Panel>

      {finished.length === 0 ? (
        <Panel className="p-4 text-xs text-ink-muted" data-testid="sweep-no-results">
          Aucun run exploitable pour l&apos;instant — les analyses apparaîtront dès le
          premier run terminé.
        </Panel>
      ) : family === "curve" ? (
        <CurveSection data={data} finished={finished} />
      ) : family === "screening" ? (
        <ScreeningSection data={data} finished={finished} />
      ) : isJudges ? (
        <JudgesSection slug={slug} data={data} kappaData={kappaData} />
      ) : (
        <PairedSection slug={slug} data={data} finished={finished} />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Famille E — courbe (taille d'entraînement ou bruit d'étiquettes)
// --------------------------------------------------------------------------- //

function CurveSection({
  data,
  finished,
}: {
  data: ExperimentAggregate;
  finished: AggregateRun[];
}) {
  const isNoise = data.axis === "label_noise";
  const withAxis = finished.filter((run) => run.axisValue != null);
  const groupsMap = new Map<number, number[]>();
  for (const run of withAxis) {
    const key = Number(run.axisValue);
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key)!.push(run.value!);
  }
  const groups: CurveGroup[] = [...groupsMap.entries()]
    .map(([x, values]) => ({ x, values }))
    .sort((a, b) => a.x - b.x);
  const points: SweepPoint[] = withAxis.map((run) => ({
    x: Number(run.axisValue),
    y: run.value!,
  }));

  const fit = isNoise ? null : fitPowerLaw(points);
  const largest = groups[groups.length - 1];
  const largestMean = largest
    ? largest.values.reduce((s, v) => s + v, 0) / largest.values.length
    : null;
  const limit = fit ? extrapolationLimit(points) : null;

  const verdict = isNoise
    ? largest && groups[0]
      ? `À ${(largest.x * 100).toFixed(0)} % de bruit d'étiquettes, la macro-F1 passe de ` +
        `${fmtMetric(groups[0]!.values.reduce((s, v) => s + v, 0) / groups[0]!.values.length)} à ` +
        `${fmtMetric(largestMean)} — la pente de dégradation importe plus que chaque point.`
      : null
    : largestMean != null
      ? `À ${largest!.x} documents, macro-F1 ${fmtMetric(largestMean)}.` +
        (fit && limit
          ? ` La tendance ajustée (loi de puissance) suggère ${fmtMetric(
              powerLawValue(fit, limit),
            )} vers ${limit} documents — extrapolation bornée à ~2,5× l'effectif observé.`
          : "")
      : null;

  return (
    <>
      {verdict && <VerdictPanel>{verdict}</VerdictPanel>}
      <LearningCurveFigure
        groups={groups}
        points={points}
        humanCeiling={data.humanCeiling?.value}
        xLabel={isNoise ? "taux de bruit d'étiquettes" : "documents d'entraînement"}
        fitCurve={!isNoise}
        title={isNoise ? "Dégradation au bruit d'étiquettes" : "Courbe d'apprentissage (F5)"}
        subtitle={
          isNoise
            ? "Le même modèle, avec des étiquettes volontairement corrompues."
            : "Chaque point est un entraînement complet ; la moyenne relie les tailles."
        }
      />
      {!isNoise && (
        <p className="text-xs text-ink-muted" data-testid="curve-saturation-note">
          Attention aux plus grandes tailles : le pool d&apos;entraînement par pli est
          borné (~31 documents sur 39) — leurs tirages se recouvrent presque entièrement,
          leur variance est artificiellement faible.
        </p>
      )}
    </>
  );
}

// --------------------------------------------------------------------------- //
// Famille D — criblage
// --------------------------------------------------------------------------- //

function ScreeningSection({
  data,
  finished,
}: {
  data: ExperimentAggregate;
  finished: AggregateRun[];
}) {
  const effects = marginalAxisEffects(finished);
  const retained = effects.filter((e) => e.effect >= EXPLORATORY_EFFECT_FLOOR);
  const negligible = effects.filter((e) => e.effect < EXPLORATORY_EFFECT_FLOOR);
  const survivors = survivalSet(finished);
  const ranked = [...finished].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const axisName = (path: string) => path.split(".").pop() ?? path;

  return (
    <>
      <VerdictPanel>
        {finished.length} configurations testées.{" "}
        {retained.length > 0
          ? `Axes avec effet (par ampleur) : ${retained
              .map((e) => `${axisName(e.axis)} (${e.effect.toFixed(3)})`)
              .join(", ")}.`
          : "Aucun axe au-dessus du seuil d'effet."}{" "}
        {negligible.length > 0
          ? `Axes négligeables au criblage (< ${EXPLORATORY_EFFECT_FLOOR}) : ${negligible
              .map((e) => axisName(e.axis))
              .join(", ")} — candidats à l'abandon pour l'étage GPU.`
          : ""}
      </VerdictPanel>

      <Panel className="p-3" data-testid="screening-exploratory-banner">
        <p className="text-xs text-ink-muted">
          Criblage <span className="font-medium text-ink">exploratoire</span> — pas de
          correction de comparaisons multiples : classement, intervalles, et règle de
          survie « retenue si son IC touche celui de la meilleure ». Les axes retenus
          seront confirmés à l&apos;étage 2 par un test apparié.
        </p>
      </Panel>

      <Panel className="p-4" data-testid="screening-ranking">
        <h3 className="text-sm font-semibold text-ink">Classement des configurations</h3>
        <div className="mt-2 space-y-1">
          {ranked.map((run) => {
            const survived = survivors.has(run.id);
            return (
              <div
                key={run.id}
                className={`flex items-center gap-2 text-xs ${survived ? "" : "opacity-50"}`}
                data-testid={`screening-row-${run.id}`}
                data-survived={survived || undefined}
              >
                <span className="w-8 shrink-0 text-right font-mono text-ink">
                  {fmtMetric(run.value)}
                </span>
                <div className="h-2 w-40 shrink-0 overflow-hidden rounded-full bg-panel-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(run.value ?? 0) * 100}%` }}
                  />
                </div>
                <span className="text-ink-muted">
                  {fmtCi(run.ci) ?? "IC indisponible"}
                </span>
                <span className="truncate text-ink">
                  {variantLabel(run.config, finished)}
                </span>
                <span
                  className={`ml-auto shrink-0 ${survived ? "text-success" : "text-ink-muted"}`}
                >
                  {survived ? "retenue" : "écartée"}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>

      {effects.length > 0 && (
        <Panel className="p-4" data-testid="screening-axis-effects">
          <h3 className="text-sm font-semibold text-ink">Effets marginaux par axe</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Moyenne de la métrique par valeur de chaque axe — la grille étant complète,
            les moyennes marginales sont équilibrées par construction.
          </p>
          <div className="mt-2 space-y-3">
            {effects.map((effect) => (
              <div key={effect.axis} className="text-xs">
                <p className="font-medium text-ink">
                  {effect.axis}{" "}
                  <span className="font-normal text-ink-muted">
                    (ampleur {effect.effect.toFixed(3)})
                  </span>
                </p>
                <div className="mt-1 space-y-0.5">
                  {effect.perValue.map((entry) => (
                    <div key={entry.value} className="flex items-center gap-2">
                      <span className="w-32 shrink-0 truncate text-ink-muted">{entry.value}</span>
                      <div className="h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-panel-muted">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${entry.mean * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-ink">{fmtMetric(entry.mean)}</span>
                      <span className="text-ink-muted">(n={entry.n})</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}

// --------------------------------------------------------------------------- //
// Famille C — comparaison appariée
// --------------------------------------------------------------------------- //

function PairedSection({
  slug,
  data,
  finished,
}: {
  slug: string;
  data: ExperimentAggregate;
  finished: AggregateRun[];
}) {
  const ranked = [...finished].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const best = ranked[0];
  const second = ranked[1];

  // Test apparié automatique meilleure-vs-seconde — la préparation du verdict. Un 409/422
  // (plis différents, prédictions absentes) bascule en mode descriptif EXPLICITE.
  const paired = useQuery({
    queryKey: ["lab", "paired", slug, best?.id, second?.id, data.metric],
    queryFn: () => comparePaired(slug, best!.id, second!.id, data.metric),
    enabled: Boolean(best && second),
    retry: false,
  });
  const unavailableReason =
    paired.error instanceof ApiError
      ? ((paired.error.body as { detail?: string } | undefined)?.detail ??
        "les runs ne sont pas comparables")
      : paired.error
        ? "erreur lors du test apparié"
        : null;

  return (
    <>
      {best && (
        <VerdictPanel>
          Meilleure variante : {variantLabel(best.config, finished)} à{" "}
          {fmtMetric(best.value)}
          {fmtCi(best.ci) ? ` ${fmtCi(best.ci)}` : ""}.
          {second ? ` Seconde : ${variantLabel(second.config, finished)} à ${fmtMetric(second.value)}.` : ""}
        </VerdictPanel>
      )}
      {second && (
        <Panel className="p-4" data-testid="paired-test-panel">
          <h3 className="text-sm font-semibold text-ink">
            Test apparié — meilleure contre seconde
          </h3>
          <div className="mt-2">
            {paired.isPending && best && second ? (
              <p className="text-xs text-ink-muted">Test apparié en cours…</p>
            ) : (
              <SignificanceNote
                result={paired.data ?? null}
                unavailableReason={unavailableReason}
              />
            )}
          </div>
        </Panel>
      )}
      <RunComparisonFigure
        rows={ranked.map((run) => ({
          runId: run.id,
          label: variantLabel(run.config, finished),
          value: run.value,
          ci: run.ci,
        }))}
        humanCeiling={data.humanCeiling?.value ?? null}
        metric={data.metric}
      />
    </>
  );
}

// --------------------------------------------------------------------------- //
// Famille F — juges LLM
// --------------------------------------------------------------------------- //

/** κ humain publié (papier ressource) — l'échelle commune de la figure F9. */
const HUMAN_KAPPA = 0.769;

function JudgesSection({
  slug,
  data,
  kappaData,
}: {
  slug: string;
  data: ExperimentAggregate;
  kappaData: ExperimentAggregate | undefined;
}) {
  const source = kappaData ?? data;
  const finished = source.runs.filter((run) => DONE.has(run.status) && run.value != null);
  const ranked = [...finished].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const judgeName = (run: AggregateRun) =>
    String((run.config.model as { judge?: string } | undefined)?.judge ?? run.id.slice(0, 8));

  const agreement = useQuery({
    queryKey: ["lab", "agreement", slug, ...finished.map((run) => run.id).sort()],
    queryFn: () => getJudgesAgreement(slug, finished.map((run) => run.id)),
    enabled: finished.length >= 2,
    retry: false,
  });

  const best = ranked[0];
  const verdict = best
    ? `Meilleur juge : ${judgeName(best)} à κ ${fmtMetric(best.value)} — contre un accord ` +
      `humain de référence κ ${HUMAN_KAPPA}. Ordre attendu par le plan : humains > ` +
      `supervisé > LLM.`
    : null;

  return (
    <>
      {verdict && <VerdictPanel>{verdict}</VerdictPanel>}
      <RunComparisonFigure
        rows={ranked.map((run) => ({
          runId: run.id,
          label: judgeName(run),
          value: run.value,
          ci: run.ci,
        }))}
        humanCeiling={HUMAN_KAPPA}
        metric="kappa"
      />
      {agreement.data && (
        <Panel className="p-4" data-testid="judges-agreement">
          <h3 className="text-sm font-semibold text-ink">Accords entre juges</h3>
          <p className="mt-1 text-xs text-ink-muted">
            α de Krippendorff {fmtMetric(agreement.data.alpha.point)}{" "}
            {fmtCi(agreement.data.alpha) ?? ""} — un accord élevé entre juges mais
            faible avec le gold signifierait qu&apos;ils font les mêmes erreurs.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="text-xs" data-testid="judges-kappa-matrix">
              <thead>
                <tr className="text-ink-muted">
                  <th scope="col" className="px-2 py-1 text-left">κ</th>
                  {agreement.data.kappa.judges.map((judge) => (
                    <th key={judge} scope="col" className="px-2 py-1 text-right">
                      {judge}
                    </th>
                  ))}
                  <th scope="col" className="px-2 py-1 text-right">vs gold</th>
                </tr>
              </thead>
              <tbody>
                {agreement.data.kappa.judges.map((row) => (
                  <tr key={row} className="border-t border-line">
                    <td className="px-2 py-1 text-ink">{row}</td>
                    {agreement.data!.kappa.judges.map((col) => (
                      <td key={col} className="px-2 py-1 text-right font-mono text-ink">
                        {fmtMetric(agreement.data!.kappa.matrix[row]?.[col])}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right font-mono text-ink">
                      {fmtMetric(agreement.data!.kappa.vsGold[row])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Baseline figée : elle ne se relance pas, elle se cite (prompt et versions
            documentés dans le plan).
          </p>
        </Panel>
      )}
    </>
  );
}
