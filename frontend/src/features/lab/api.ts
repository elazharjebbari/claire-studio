import { apiFetch } from "@/lib/api/client";

import type {
  ComputeCredential,
  DatasetSummary,
  EstimateResponse,
  ExperimentSummary,
  GpuClusterCatalog,
  LaunchResponse,
  PreflightReport,
  PresetCatalog,
  ProgramsResponse,
  RunDetail,
  RunSummary,
} from "./types";

const root = (slug: string) => `/projects/${slug}/lab`;

export interface DatasetCriteria {
  label?: string;
  maturity: string;
  aggregation: string;
  documents?: string[];
  annotators?: string[];
  minAnnotators?: number;
  excludePartial?: boolean;
  completenessThreshold?: number;
  k?: number;
  seed?: number;
  force?: boolean;
}

/**
 * Simulation SANS création. Le point d'ergonomie central du Lab : on voit ce qu'on
 * obtiendra — et surtout ce qui sera écarté — avant de s'engager.
 */
export function preflight(slug: string, criteria: DatasetCriteria): Promise<PreflightReport> {
  return apiFetch(`${root(slug)}/datasets/preflight`, { method: "POST", body: criteria });
}

export function listDatasets(slug: string): Promise<DatasetSummary[]> {
  return apiFetch(`${root(slug)}/datasets`);
}

export function buildDataset(
  slug: string,
  criteria: DatasetCriteria,
): Promise<DatasetSummary> {
  return apiFetch(`${root(slug)}/datasets`, { method: "POST", body: criteria });
}

/** Catalogue des presets scientifiques (mode guidé de « Nouvelle expérience »). */
export function listPresets(slug: string): Promise<PresetCatalog> {
  return apiFetch(`${root(slug)}/presets`);
}

/** Programmes ciblés (papier long / papier court) + avancement par preset dérivé des
 * runs réels — filtré par dataset quand fourni (un statut toutes-données-confondues
 * mentirait sur l'avancement d'une campagne liée à UN dataset). */
export function getPrograms(slug: string, datasetId?: string): Promise<ProgramsResponse> {
  const query = datasetId ? `?dataset=${encodeURIComponent(datasetId)}` : "";
  return apiFetch(`${root(slug)}/programs${query}`);
}

export function createExperiment(
  slug: string,
  payload: { name: string; task: string; dataset: string; config: Record<string, unknown> },
): Promise<ExperimentSummary> {
  return apiFetch(`${root(slug)}/experiments`, { method: "POST", body: payload });
}

/** Combien de runs, et pour combien de temps — à savoir AVANT de lancer. */
export function estimateExperiment(slug: string, experimentId: string): Promise<EstimateResponse> {
  return apiFetch(`${root(slug)}/experiments/${experimentId}/estimate`, { method: "POST" });
}

export function launchExperiment(
  slug: string,
  experimentId: string,
  force = false,
): Promise<LaunchResponse> {
  return apiFetch(`${root(slug)}/experiments/${experimentId}/run`, {
    method: "POST",
    body: { force },
  });
}

export function listRuns(slug: string, status?: string): Promise<RunSummary[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch(`${root(slug)}/runs${query}`);
}

export function getRun(slug: string, runId: string): Promise<RunDetail> {
  return apiFetch(`${root(slug)}/runs/${runId}`);
}

export function cancelRun(slug: string, runId: string): Promise<{ status: string }> {
  return apiFetch(`${root(slug)}/runs/${runId}/cancel`, { method: "POST" });
}

export function compareRuns(
  slug: string,
  runIds: string[],
  metric = "macro_f1",
): Promise<{
  comparable: boolean;
  incomparableReason: string | null;
  rows: Array<{
    runId: string;
    label: string;
    value: number | null;
    /** IC bootstrap par document — le serveur l'a toujours renvoyé, le type l'omettait
     * et l'UI le jetait (bug documenté, docs/pactiva-lab-resultats/01_AUDIT.md §2). */
    ci: { low: number | null; high: number | null } | null;
    humanCeiling: number | null;
  }>;
}> {
  return apiFetch(`${root(slug)}/compare`, {
    method: "POST",
    body: { runIds, metric },
  });
}

export interface PairedTestResult {
  metric: string;
  delta: number;
  low: number | null;
  high: number | null;
  pValue: number | null;
  nDocuments: number;
  nResamples: number;
  nPermutations: number;
  unit: string;
  confidence: number;
  runA: string;
  runB: string;
  labelA: string;
  labelB: string;
  test: string;
  warning?: string;
}

/** Test apparié par document entre deux runs (mêmes plis exigés — 409 sinon ; 422 avec
 * code stable si les prédictions par phrase manquent → l'UI bascule en mode
 * descriptif, jamais un test silencieusement absent). */
export function comparePaired(
  slug: string,
  runA: string,
  runB: string,
  metric = "macro_f1",
): Promise<PairedTestResult> {
  return apiFetch(`${root(slug)}/compare/paired`, {
    method: "POST",
    body: { runA, runB, metric },
  });
}

export interface AggregateRun {
  id: string;
  status: string;
  value: number | null;
  ci: { point?: number; low: number | null; high: number | null } | null;
  axisValue: number | null;
  config: Record<string, unknown>;
}

export interface ExperimentAggregate {
  experiment: string;
  name: string;
  preset: string;
  metric: string;
  axis: string | null;
  humanCeiling: { value: number | null; ci?: { low: number | null; high: number | null } } | null;
  runs: AggregateRun[];
}

/** Vue agrégée d'un sweep — sert les familles « criblage » et « courbe ». */
export function getExperimentAggregate(
  slug: string,
  experimentId: string,
  metric = "macro_f1",
): Promise<ExperimentAggregate> {
  return apiFetch(
    `${root(slug)}/experiments/${experimentId}/aggregate?metric=${encodeURIComponent(metric)}`,
  );
}

export interface JudgesAgreement {
  kappa: {
    judges: string[];
    /** LISTES alignées sur `judges` — jamais des dicts clefs par nom de juge : la
     * camélisation DRF transformerait les clés (« gpt_4o » → « gpt4O ») et les
     * rendrait incroisables avec la liste (revue adversariale du 15 août 2026). */
    matrix: number[][];
    vsGold: number[];
    n: number;
  };
  alpha: { point: number; low: number | null; high: number | null };
}

/** Accords entre runs de juges : matrice κ par paire + α de Krippendorff avec IC. */
export function getJudgesAgreement(
  slug: string,
  runIds: string[],
): Promise<JudgesAgreement> {
  return apiFetch(`${root(slug)}/agreement`, { method: "POST", body: { runIds } });
}

/**
 * Identifiants de calcul. `configured` dit si le serveur peut chiffrer — l'UI s'en sert
 * pour DÉSACTIVER la cible distante avec un motif, plutôt que de la faire disparaître.
 */
export function getCredentials(): Promise<{
  configured: boolean;
  credentials: ComputeCredential[];
}> {
  return apiFetch(`/me/compute-credentials`);
}

export function saveCredential(payload: {
  kind: string;
  login: string;
  /** Omis = mot de passe déjà enregistré conservé tel quel — permet d'ajouter/modifier
   * SEULEMENT la clé SSH sans le retaper. */
  password?: string;
  /** Omise = clé SSH déjà enregistrée conservée telle quelle (le serveur ne l'efface
   * jamais silencieusement au passage d'une mise à jour du mot de passe). */
  sshKey?: string;
}): Promise<ComputeCredential> {
  return apiFetch(`/me/compute-credentials`, { method: "PUT", body: payload });
}

export function testCredential(
  credentialId: number,
): Promise<{ ok: boolean; apiOk: boolean; sshOk: boolean | null; detail: string; testedAt: string }> {
  return apiFetch(`/me/compute-credentials/${credentialId}/test`, { method: "POST" });
}

export function deleteCredential(credentialId: number): Promise<void> {
  return apiFetch(`/me/compute-credentials/${credentialId}`, { method: "DELETE" });
}

/** Clusters GPU Grid'5000 dont la VRAM convient — catalogue statique, informatif même
 * sans identifiants configurés (voir docs/pactiva-g5k/07_ARCHITECTURE.md). */
export function listGpuClusters(slug: string, minVramGb: number): Promise<GpuClusterCatalog> {
  return apiFetch(`${root(slug)}/g5k/clusters?minVramGb=${minVramGb}`);
}
