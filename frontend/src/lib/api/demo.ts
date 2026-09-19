/**
 * Public demo API (`/api/v1/public/demo/*`) — no authentication, no token attached.
 *
 * Every endpoint is `AllowAny`: `apiFetch` sends no Authorization header when no token is
 * stored, and a public page must never trigger the global 401 handler. Responses are
 * camelCase (DRF bridge).
 */

import { apiFetch } from "./client";

export interface DemoFigure {
  key: string;
  label: string;
  t20: number | null;
  t11: number | null;
  source: string;
  how: string;
  extra?: Record<string, number | null>;
}

export interface DemoDownload {
  name: string;
  path: string;
  bytes: number;
  sha256: string;
  records: number | null;
  description: string;
}

export interface DemoModelCard {
  checkpoint: string;
  taxonomy: string;
  trainedOn: { documents: number | null; population: string };
  evaluatedOn: { documents: number | null; population: string };
  metrics: { macroF1: number | null; microF1: number | null; kappa: number | null; macroF1Ci?: { low: number; high: number } | null };
  recipe: Record<string, string | number>;
  datasetFingerprint: string;
}

export interface DemoManifest {
  datasetFingerprint: string | null;
  release: { version: number | null; builtAt: string | null };
  counts: Record<string, number | string[] | null>;
  zip: { path: string; bytes: number; sha256: string } | null;
  downloads: DemoDownload[];
  judges: Array<{ id: string; model: string }>;
  figures: DemoFigure[];
  model: DemoModelCard | null;
  limits: { maxChars: number; maxSentences: number; language: string };
  accessCodeRequired: boolean;
  modelAvailable: boolean;
  holdoutDocuments: string[];
}

export interface DemoContract {
  document: string;
  nSentences: number;
  nUnfair: number;
}

export interface DemoPrediction {
  index: number;
  text: string;
  label: string;
  confidence: number;
  scores: Record<string, number>;
}

export interface DemoComparison {
  gold: Array<{ index: number; primaryT20: string | null; primaryT11: string | null; agreementClass: string | null; tier: string | null; secondaries: string[] }>;
  votes: Array<Record<string, string | number | null>>;
  judges: Array<Record<string, string | number | null>>;
  summary: { nSentences: number; accuracyT11: number | null; kappaT11: number | null; judgesAccuracyT11: Record<string, number | null> };
  judgesLegend: Record<string, string>;
}

export interface DemoResult {
  segmenter: string;
  classes: string[];
  sentences: DemoPrediction[];
  truncated: boolean;
  timingS?: number;
  comparison?: DemoComparison | null;
}

export type DemoJobStatus = "queued" | "running" | "done" | "failed";

export interface DemoJob {
  jobId: string;
  status: DemoJobStatus;
  source: "text" | "contract";
  document: string | null;
  title: string | null;
  timings: { queuedS: number | null; runS: number | null };
  result: DemoResult | null;
  error: { code: string; detail: string } | null;
}

export type ClassifyRequest =
  | { source: "text"; text: string; title?: string }
  | { source: "contract"; document: string };

export function getDemoManifest() {
  return apiFetch<DemoManifest>("/public/demo/manifest");
}

export function listDemoContracts() {
  return apiFetch<{ contracts: DemoContract[] }>("/public/demo/contracts");
}

export function startClassification(body: ClassifyRequest, accessCode?: string) {
  return apiFetch<{ jobId: string; status: DemoJobStatus; position: number }>("/public/demo/classify", {
    method: "POST",
    body,
    headers: accessCode ? { "X-Demo-Code": accessCode } : undefined,
  });
}

export function getDemoJob(jobId: string) {
  return apiFetch<DemoJob>(`/public/demo/jobs/${jobId}`);
}
