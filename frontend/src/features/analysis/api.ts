import { apiFetch, apiFetchBlob } from "@/lib/api/client";
import type {
  AnalysisReport,
  AnalysisPreset,
  AnalysisRun,
  AnalysisSnapshot,
  ListEnvelope,
  ReportComparison,
  ReportArtifact,
} from "./types";

const root = (slug: string) => `/projects/${slug}/analysis`;

export function listSnapshots(slug: string): Promise<ListEnvelope<AnalysisSnapshot>> {
  return apiFetch(`${root(slug)}/snapshots`);
}

export function listPresets(slug: string): Promise<ListEnvelope<AnalysisPreset>> {
  return apiFetch(`${root(slug)}/presets`);
}

export function createPreset(
  slug: string,
  payload: { name: string; configuration: AnalysisPreset["configuration"] },
): Promise<AnalysisPreset> {
  return apiFetch(`${root(slug)}/presets`, { method: "POST", body: payload });
}

export function createSnapshot(
  slug: string,
  payload: { label?: string; includeDrafts: boolean },
): Promise<AnalysisSnapshot> {
  return apiFetch(`${root(slug)}/snapshots`, { method: "POST", body: payload });
}

export function createRun(slug: string, snapshotId: string): Promise<AnalysisRun> {
  // `metricCodes` est OMIS délibérément : le fixer ici dupliquait la liste des
  // métriques du backend (`DEFAULT_METRICS`), et c'est exactement cette duplication
  // qui a fait tourner l'app sans les 8 métriques du chantier Lab pendant deux commits
  // entiers — les tests passaient (fixtures construites à la main), mais aucun run réel
  // ne les demandait jamais. Omettre le champ laisse le serveur appliquer sa propre
  // liste par défaut, qui reste donc la SEULE source de vérité.
  return apiFetch(`${root(slug)}/runs`, {
    method: "POST",
    body: { snapshotId },
  });
}

export function getRun(slug: string, id: string): Promise<AnalysisRun> {
  return apiFetch(`${root(slug)}/runs/${id}`);
}

export function listReports(slug: string, page = 1): Promise<ListEnvelope<AnalysisReport>> {
  return apiFetch(`${root(slug)}/reports?page=${page}`);
}

export function getReport(slug: string, id: string): Promise<AnalysisReport> {
  return apiFetch(`${root(slug)}/reports/${id}`);
}

export function createReport(
  slug: string,
  payload: { runId: string; title: string },
): Promise<AnalysisReport> {
  return apiFetch(`${root(slug)}/reports`, { method: "POST", body: payload });
}

export function compareReport(slug: string, id: string): Promise<ReportComparison> {
  return apiFetch(`${root(slug)}/reports/${id}/compare`);
}

export function patchReport(
  slug: string,
  id: string,
  payload: { title?: string; status?: "ready" | "archived" },
): Promise<AnalysisReport> {
  return apiFetch(`${root(slug)}/reports/${id}`, { method: "PATCH", body: payload });
}

export function renderReport(slug: string, reportId: string): Promise<ReportArtifact> {
  return apiFetch(`${root(slug)}/reports/${reportId}/render`, { method: "POST", body: {} });
}

export function getArtifact(slug: string, id: string): Promise<ReportArtifact> {
  return apiFetch(`${root(slug)}/artifacts/${id}`);
}

export async function downloadArtifact(slug: string, artifact: ReportArtifact): Promise<void> {
  const blob = await apiFetchBlob(`${root(slug)}/artifacts/${artifact.id}/download`);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pactiva-analysis-${artifact.reportId}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
