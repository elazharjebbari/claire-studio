"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  BarChart3,
  Camera,
  ChevronRight,
  Download,
  FileClock,
  Info,
  RefreshCw,
  Save,
} from "lucide-react";
import { Disclosure } from "@/components/ui/Disclosure";
import { Badge, Button, Panel } from "@/components/ui/primitives";
import { ReadinessPanel } from "@/features/lab/ReadinessPanel";
import {
  AgreementMatrixFigure,
  AlphaComparisonFigure,
  BoundaryAgreementFigure,
  CooccurrenceFigure,
  GoldCascadeFigure,
  LongTailFigure,
} from "./charts/figures";
import {
  useAnalysisReport,
  useAnalysisReports,
  useAnalysisRun,
  useAnalysisArtifact,
  useAnalysisPresets,
  useArchiveReport,
  useCreateAnalysis,
  useCreateAnalysisReport,
  useCreateAnalysisPreset,
  useDownloadArtifact,
  useRenderReport,
  useReportComparison,
} from "./hooks";
import type { AnalysisOverview, AnalysisResult } from "./types";

function percent(value: number | null | undefined) {
  return value == null ? "—" : `${Math.round(value * 100)} %`;
}

function Kpi({
  label,
  value,
  delta,
}: {
  label: string;
  value: string | number;
  delta?: number | null;
}) {
  return (
    <Panel className="p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {label}
        </span>
        {delta != null && delta !== 0 && (
          <span className={delta > 0 ? "text-xs text-success" : "text-xs text-danger"}>
            {delta > 0 ? "+" : ""}
            {Number.isInteger(delta) ? delta : `${Math.round(delta * 100)} pt`}
          </span>
        )}
      </div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
    </Panel>
  );
}

function Overview({
  data,
  delta,
}: {
  data: AnalysisOverview;
  delta?: Record<string, number | null>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="analysis-kpis">
      <Kpi label="Documents" value={data.documents} delta={delta?.documents} />
      <Kpi label="Annotations" value={data.annotations} delta={delta?.annotations} />
      <Kpi
        label="Brouillons inclus"
        value={data.draftAnnotations}
        delta={delta?.draftAnnotations}
      />
      <Kpi label="Couverture" value={percent(data.coverageRate)} delta={delta?.coverageRate} />
    </div>
  );
}

function ActorTable({ result }: { result: AnalysisResult }) {
  const actors = result.actorProfiles?.actors ?? [];
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-semibold text-ink">Détail des observations figées</h2>
        <p className="text-xs text-ink-muted">
          Les brouillons sont signalés et ne sont jamais confondus avec les publications.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-panel-muted text-xs uppercase text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-2">
                Acteur
              </th>
              <th scope="col" className="px-4 py-2">
                Affectés
              </th>
              <th scope="col" className="px-4 py-2">
                Brouillons
              </th>
              <th scope="col" className="px-4 py-2">
                Publiés
              </th>
              <th scope="col" className="px-4 py-2">
                Clauses
              </th>
              <th scope="col" className="px-4 py-2">
                Couverture
              </th>
              <th scope="col" className="px-4 py-2">
                Validation
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {actors.map((actor) => (
              <tr key={actor.actorKey}>
                <th scope="row" className="px-4 py-2 font-medium text-ink">
                  {actor.pseudonym}
                </th>
                <td className="px-4 py-2">{actor.assignedDocuments}</td>
                <td className="px-4 py-2">
                  <Badge>{actor.draftAnnotations}</Badge>
                </td>
                <td className="px-4 py-2">{actor.publishedAnnotations}</td>
                <td className="px-4 py-2">{actor.clauses}</td>
                <td className="px-4 py-2">{percent(actor.coverageRate)}</td>
                <td className="px-4 py-2">{percent(actor.validationRate)}</td>
              </tr>
            ))}
            {actors.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">
                  Aucune observation dans ce snapshot.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function AnalysisLab({ slug }: { slug: string }) {
  const presets = useAnalysisPresets(slug);
  const createPreset = useCreateAnalysisPreset(slug);
  const [reportsPage, setReportsPage] = useState(1);
  const reports = useAnalysisReports(slug, reportsPage);
  const createAnalysis = useCreateAnalysis(slug);
  const createReport = useCreateAnalysisReport(slug);
  const archiveReport = useArchiveReport(slug);
  const renderReport = useRenderReport(slug);
  const downloadArtifact = useDownloadArtifact(slug);
  const [currentRun, setCurrentRun] = useState<
    Awaited<ReturnType<typeof createAnalysis.mutateAsync>>["run"] | null
  >(null);
  const liveRun = useAnalysisRun(slug, currentRun?.id ?? null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [artifactId, setArtifactId] = useState<string | null>(null);
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const artifact = useAnalysisArtifact(slug, artifactId);
  const [mode, setMode] = useState<
    "overview" | "quality" | "agreement" | "reliability" | "gold" | "taxonomy"
  >("overview");
  const selectedReport = useAnalysisReport(slug, selectedReportId);
  const comparison = useReportComparison(slug, selectedReportId);

  const effectiveRun = liveRun.data ?? currentRun;
  const result = selectedReport.data?.payload ?? effectiveRun?.result;
  const overview = result?.overview;
  const latestReport = reports.data?.results[0];
  const visibleReports = useMemo(() => reports.data?.results ?? [], [reports.data]);

  async function analyzeNow() {
    const stamp = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
    const created = await createAnalysis.mutateAsync({
      label: `Snapshot du ${stamp}`,
      includeDrafts,
    });
    setCurrentRun(created.run);
    setSelectedReportId(null);
    setArtifactId(null);
  }

  async function saveReport() {
    if (!effectiveRun) return;
    const report = await createReport.mutateAsync({
      runId: effectiveRun.id,
      title: `Rapport du ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date())}`,
    });
    setSelectedReportId(report.id);
    setCurrentRun(null);
    setArtifactId(null);
  }

  async function requestPdf() {
    if (!selectedReportId) return;
    const created = await renderReport.mutateAsync(selectedReportId);
    setArtifactId(created.id);
  }

  async function savePreset() {
    await createPreset.mutateAsync({
      name: `Suivi ${includeDrafts ? "avec" : "sans"} brouillons - ${mode}`,
      configuration: { includeDrafts, mode },
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6" data-testid="analysis-lab">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <BarChart3 size={16} aria-hidden /> Analyse & qualité
          </div>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
            Pactiva Analysis Lab
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Figez l’état actuel, y compris vos annotations non publiées, puis suivez l’évolution
            sans modifier les sources.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={includeDrafts}
              onChange={(event) => setIncludeDrafts(event.target.checked)}
              className="accent-accent"
            />
            Inclure les brouillons
          </label>
          {presets.data?.results.length ? (
            <select
              aria-label="Vue enregistrée"
              className="rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink"
              defaultValue=""
              onChange={(event) => {
                const preset = presets.data?.results.find((item) => item.id === event.target.value);
                if (!preset) return;
                setIncludeDrafts(preset.configuration.includeDrafts ?? true);
                const savedMode = preset.configuration.mode;
                if (
                  ["overview", "quality", "agreement", "reliability", "gold", "taxonomy"].includes(
                    savedMode ?? "",
                  )
                ) {
                  setMode(savedMode as typeof mode);
                }
              }}
            >
              <option value="" disabled>
                Vues enregistrées
              </option>
              {presets.data.results.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          ) : null}
          <Button
            size="sm"
            state={createPreset.isPending ? "pending" : "idle"}
            onClick={savePreset}
          >
            Enregistrer la vue
          </Button>
          <Button
            variant="primary"
            icon={<Camera size={15} />}
            state={createAnalysis.isPending ? "pending" : "idle"}
            onClick={analyzeNow}
          >
            Analyser l’état actuel
          </Button>
          {effectiveRun?.status === "succeeded" && !selectedReportId && (
            <Button
              icon={<Save size={15} />}
              state={createReport.isPending ? "pending" : "idle"}
              onClick={saveReport}
            >
              Conserver comme rapport
            </Button>
          )}
          {selectedReportId && !artifact.data && (
            <Button
              icon={<Download size={15} />}
              state={renderReport.isPending ? "pending" : "idle"}
              onClick={requestPdf}
            >
              Préparer le PDF
            </Button>
          )}
          {selectedReportId && artifact.data?.status === "ready" && (
            <Button
              icon={<Download size={15} />}
              state={downloadArtifact.isPending ? "pending" : "idle"}
              onClick={() => downloadArtifact.mutate(artifact.data!)}
            >
              Télécharger le PDF
            </Button>
          )}
        </div>
      </header>

      <Disclosure
        summary="Comprendre cette analyse"
        icon={<Info size={14} />}
        className="mt-5"
        testId="analysis-guide"
      >
        <div className="grid gap-3 pt-2 text-sm text-ink-muted md:grid-cols-2 lg:grid-cols-4">
          <p>
            <strong className="text-ink">Pourquoi ?</strong>
            <br />
            Mesurer un état précis sans attendre la fin de la campagne.
          </p>
          <p>
            <strong className="text-ink">Comment ?</strong>
            <br />
            Les calculs lisent une copie immuable et pseudonymisée.
          </p>
          <p>
            <strong className="text-ink">Que faire ?</strong>
            <br />
            Conserver un rapport puis le comparer aux précédents.
          </p>
          <p>
            <strong className="text-ink">Précaution</strong>
            <br />
            Un brouillon décrit un état provisoire, pas une décision publiée.
          </p>
        </div>
      </Disclosure>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-5">
          {(createAnalysis.error ||
            createReport.error ||
            createPreset.error ||
            renderReport.error ||
            artifact.error) && (
            <Panel className="border-danger/50 p-4 text-sm text-danger" role="alert">
              L’opération a échoué. Réessayez ou vérifiez vos permissions.
            </Panel>
          )}
          {!overview && (
            <Panel className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
              <Camera size={30} className="text-accent" aria-hidden />
              <h2 className="mt-3 font-semibold text-ink">Aucune analyse sélectionnée</h2>
              <p className="mt-1 max-w-md text-sm text-ink-muted">
                Créez un snapshot de l’état actuel ou ouvrez un ancien rapport. Les brouillons sont
                acceptés.
              </p>
            </Panel>
          )}
          {effectiveRun && ["queued", "running"].includes(effectiveRun.status) && (
            <Panel className="p-4" role="status">
              <div className="flex items-center justify-between text-sm text-ink">
                <span>Calcul durable en cours</span>
                <span>{effectiveRun.progress} %</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-muted">
                <div className="h-full bg-accent" style={{ width: `${effectiveRun.progress}%` }} />
              </div>
            </Panel>
          )}
          {overview && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <Badge>
                  {selectedReport.data
                    ? "Rapport historique"
                    : "Snapshot non enregistré en rapport"}
                </Badge>
                {overview.draftAnnotations > 0 && (
                  <Badge className="border-warning/50 text-warning">
                    {overview.draftAnnotations} brouillon(s)
                  </Badge>
                )}
                <span>
                  Support : {overview.coveredSentences}/{overview.eligibleSentences} phrases
                  couvertes
                </span>
              </div>
              <Overview data={overview} delta={comparison.data?.delta} />
              <div className="flex flex-wrap gap-1 border-b border-line" role="tablist">
                {(
                  [
                    ["overview", "Vue d’ensemble"],
                    ["quality", "Qualité"],
                    ["agreement", "Accords"],
                    ["reliability", "Fiabilité"],
                    ["gold", "Gold"],
                    ["taxonomy", "Taxonomie"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={mode === key}
                    onClick={() => setMode(key)}
                    className={
                      mode === key
                        ? "border-b-2 border-accent px-3 py-2 text-sm font-medium text-ink"
                        : "px-3 py-2 text-sm text-ink-muted hover:text-ink"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              {mode === "overview" && (
                <div className="space-y-4">
                  {result?.campaignReadiness && (
                    <ReadinessPanel readiness={result.campaignReadiness} slug={slug} />
                  )}
                  <ActorTable result={result!} />
                </div>
              )}
              {mode === "quality" && result?.quality && (
                <Panel className="p-4">
                  <h2 className="font-semibold text-ink">Qualité des observations</h2>
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Kpi label="Clauses" value={result.quality.clauses} />
                    <Kpi label="Multi-label" value={percent(result.quality.multilabelRate)} />
                    <Kpi label="Validation" value={percent(result.quality.validationRate)} />
                    <Kpi
                      label="Certitude manquante"
                      value={result.quality.certaintyDistribution.missing ?? 0}
                    />
                  </div>
                </Panel>
              )}
              {mode === "agreement" && result?.pairwiseAgreement && (
                <Panel className="overflow-hidden">
                  <div className="border-b border-line px-4 py-3">
                    <h2 className="font-semibold text-ink">Accords multi-annotations</h2>
                    <p className="text-xs text-ink-muted">
                      {result.pairwiseAgreement.caseCount} désaccord(s), support toujours visible.
                    </p>
                    {result.intraAnnotator?.meanStability != null && (
                      <p className="mt-1 text-xs text-ink-muted">
                        Stabilité entre versions : {percent(result.intraAnnotator.meanStability)}
                      </p>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-panel-muted text-xs uppercase text-ink-muted">
                        <tr>
                          <th className="px-3 py-2">Mode</th>
                          <th className="px-3 py-2">Acteurs</th>
                          <th className="px-3 py-2">Support</th>
                          <th className="px-3 py-2">Accord</th>
                          <th className="px-3 py-2">Kappa</th>
                          <th className="px-3 py-2">F1 frontières</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {result.pairwiseAgreement.pairs.map((pair) => (
                          <tr key={`${pair.documentId}-${pair.actorA}-${pair.actorB}`}>
                            <td className="px-3 py-2">{pair.mode}</td>
                            <td className="px-3 py-2">
                              {pair.actorA} / {pair.actorB}
                            </td>
                            <td className="px-3 py-2">{pair.support}</td>
                            <td className="px-3 py-2">{percent(pair.rawAgreement)}</td>
                            <td className="px-3 py-2">{pair.cohenKappa.toFixed(3)}</td>
                            <td className="px-3 py-2">{pair.boundaryF1.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              )}
              {mode === "reliability" && (
                <div className="space-y-4">
                  {!result?.alphaMasi && !result?.boundaryAgreement && !result?.humanLlmMatrix && (
                    <Panel className="p-4 text-xs text-ink-muted">
                      Ce rapport a été produit avant l&apos;enrichissement Lab : relancez une
                      analyse pour obtenir les mesures de fiabilité (α-MASI, frontières,
                      matrice humains × LLM).
                    </Panel>
                  )}
                  {result?.alphaMasi && <AlphaComparisonFigure report={result.alphaMasi} />}
                  {result?.boundaryAgreement && (
                    <BoundaryAgreementFigure
                      rows={result.boundaryAgreement.perDocument}
                      themeAgreement={result.pairwiseAgreement?.meanKappa ?? null}
                    />
                  )}
                  {result?.humanLlmMatrix && (
                    <AgreementMatrixFigure
                      actors={result.humanLlmMatrix.actors}
                      cells={result.humanLlmMatrix.cells}
                      humanMean={result.humanLlmMatrix.humanMean}
                      crossMean={result.humanLlmMatrix.crossMean}
                    />
                  )}
                </div>
              )}
              {mode === "gold" && result?.goldAnalysis && (
                <div className="space-y-4">
                  <Panel className="p-4">
                    <h2 className="font-semibold text-ink">Readiness et proximité Gold</h2>
                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                      <Kpi label="Unités Gold" value={result.goldAnalysis.goldUnits} />
                      <Kpi label="Décidées" value={result.goldAnalysis.decidedUnits} />
                      <Kpi label="Readiness" value={percent(result.goldAnalysis.readinessRate)} />
                    </div>
                  </Panel>
                  {result.goldProgress && (
                    <GoldCascadeFigure
                      data={{
                        byAutoLevel: result.goldProgress.byAutoLevel,
                        sentences: result.goldProgress.sentences,
                        decided: result.goldProgress.decided,
                      }}
                    />
                  )}
                </div>
              )}
              {mode === "taxonomy" && result?.taxonomy && (
                <div className="space-y-4">
                  <Panel className="p-4">
                    <h2 className="font-semibold text-ink">Atlas de la taxonomie</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {result.taxonomy.primaryThemes.map((theme) => (
                        <Badge key={theme.theme}>
                          {theme.theme} · {theme.count}
                        </Badge>
                      ))}
                    </div>
                    {result.taxonomy.rareThemes.length > 0 && (
                      <p className="mt-3 text-xs text-ink-muted">
                        Thèmes à faible support : {result.taxonomy.rareThemes.join(", ")}
                      </p>
                    )}
                  </Panel>
                  {result.labelDistribution && (
                    <LongTailFigure
                      themes={result.labelDistribution.themes}
                      rareThreshold={result.labelDistribution.rareThreshold}
                    />
                  )}
                  {result.cooccurrence && (
                    <CooccurrenceFigure
                      pairs={result.cooccurrence.pairs}
                      cardinalityLift={result.cooccurrence.cardinalityLift}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </main>

        <aside className="min-w-0">
          <Panel className="overflow-hidden xl:sticky xl:top-4">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <h2 className="font-semibold text-ink">Historique</h2>
                <p className="text-xs text-ink-muted">
                  {reports.data?.count ?? 0} rapport(s) conservé(s)
                </p>
              </div>
              <FileClock size={18} className="text-accent" aria-hidden />
            </div>
            <ul className="max-h-[620px] divide-y divide-line overflow-auto">
              {visibleReports.map((report, index) => (
                <li
                  key={report.id}
                  className={selectedReportId === report.id ? "bg-panel-muted" : undefined}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReportId(report.id);
                      setCurrentRun(null);
                      setArtifactId(null);
                    }}
                    className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-panel-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{report.title}</div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-ink-muted">
                        <span>
                          {new Intl.DateTimeFormat("fr-FR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(report.createdAt))}
                        </span>
                        {report.summary.draftAnnotations > 0 && (
                          <span>· {report.summary.draftAnnotations} brouillon(s)</span>
                        )}
                        {index === 0 && <Badge>Récent</Badge>}
                      </div>
                    </div>
                    <ChevronRight
                      size={15}
                      className="mt-0.5 shrink-0 text-ink-muted"
                      aria-hidden
                    />
                  </button>
                  {selectedReportId === report.id && report.status !== "archived" && (
                    <button
                      type="button"
                      onClick={() => archiveReport.mutate(report.id)}
                      className="mb-2 ml-4 inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
                    >
                      <Archive size={12} /> Archiver
                    </button>
                  )}
                </li>
              ))}
              {visibleReports.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-ink-muted">
                  Enregistrez une première analyse pour commencer la chronologie.
                </li>
              )}
            </ul>
            {(reports.data?.previous || reports.data?.next) && (
              <nav
                className="flex items-center justify-between border-t border-line px-3 py-2"
                aria-label="Pages de l’historique"
              >
                <Button
                  size="sm"
                  disabled={!reports.data.previous}
                  onClick={() => setReportsPage((page) => Math.max(1, page - 1))}
                >
                  Précédents
                </Button>
                <span className="text-xs text-ink-muted">Page {reportsPage}</span>
                <Button
                  size="sm"
                  disabled={!reports.data.next}
                  onClick={() => setReportsPage((page) => page + 1)}
                >
                  Suivants
                </Button>
              </nav>
            )}
            {latestReport && (
              <div className="border-t border-line px-4 py-2 text-[11px] text-ink-muted">
                <RefreshCw size={11} className="mr-1 inline" /> Les anciens rapports restent
                calculés sur leur snapshot d’origine.
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
