import { apiFetch } from "@/lib/api/client";

import type {
  ComputeCredential,
  DatasetSummary,
  EstimateResponse,
  ExperimentSummary,
  LaunchResponse,
  PreflightReport,
  PresetCatalog,
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
    humanCeiling: number | null;
  }>;
}> {
  return apiFetch(`${root(slug)}/compare`, {
    method: "POST",
    body: { runIds, metric },
  });
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
  password: string;
}): Promise<ComputeCredential> {
  return apiFetch(`/me/compute-credentials`, { method: "PUT", body: payload });
}

export function testCredential(
  credentialId: number,
): Promise<{ ok: boolean; detail: string; testedAt: string }> {
  return apiFetch(`/me/compute-credentials/${credentialId}/test`, { method: "POST" });
}

export function deleteCredential(credentialId: number): Promise<void> {
  return apiFetch(`/me/compute-credentials/${credentialId}`, { method: "DELETE" });
}
