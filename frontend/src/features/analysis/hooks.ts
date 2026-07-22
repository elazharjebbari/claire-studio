"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

const keys = {
  snapshots: (slug: string) => ["analysis", slug, "snapshots"] as const,
  presets: (slug: string) => ["analysis", slug, "presets"] as const,
  reports: (slug: string) => ["analysis", slug, "reports"] as const,
  reportsPage: (slug: string, page: number) => ["analysis", slug, "reports", { page }] as const,
  report: (slug: string, id: string) => ["analysis", slug, "reports", id] as const,
  comparison: (slug: string, id: string) =>
    ["analysis", slug, "reports", id, "comparison"] as const,
  run: (slug: string, id: string) => ["analysis", slug, "runs", id] as const,
  artifact: (slug: string, id: string) => ["analysis", slug, "artifacts", id] as const,
};

export function useAnalysisSnapshots(slug: string) {
  return useQuery({ queryKey: keys.snapshots(slug), queryFn: () => api.listSnapshots(slug) });
}

export function useAnalysisPresets(slug: string) {
  return useQuery({ queryKey: keys.presets(slug), queryFn: () => api.listPresets(slug) });
}

export function useCreateAnalysisPreset(slug: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      configuration: { includeDrafts: boolean; mode: string };
    }) => api.createPreset(slug, payload),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.presets(slug) }),
  });
}

export function useAnalysisRun(slug: string, id: string | null) {
  return useQuery({
    queryKey: keys.run(slug, id ?? ""),
    queryFn: () => api.getRun(slug, id!),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      ["queued", "running"].includes(query.state.data?.status ?? "") ? 1000 : false,
  });
}

export function useCreateAnalysis(slug: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ label, includeDrafts }: { label: string; includeDrafts: boolean }) => {
      const snapshot = await api.createSnapshot(slug, { label, includeDrafts });
      const run = await api.createRun(slug, snapshot.id);
      return { snapshot, run };
    },
    onSuccess: () => client.invalidateQueries({ queryKey: keys.snapshots(slug) }),
  });
}

export function useAnalysisReports(slug: string, page = 1) {
  return useQuery({
    queryKey: keys.reportsPage(slug, page),
    queryFn: () => api.listReports(slug, page),
    placeholderData: (previous) => previous,
  });
}

export function useAnalysisReport(slug: string, id: string | null) {
  return useQuery({
    queryKey: keys.report(slug, id ?? ""),
    queryFn: () => api.getReport(slug, id!),
    enabled: Boolean(id),
  });
}

export function useCreateAnalysisReport(slug: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { runId: string; title: string }) => api.createReport(slug, payload),
    onSuccess: (report) => {
      client.invalidateQueries({ queryKey: keys.reports(slug) });
      client.setQueryData(keys.report(slug, report.id), report);
    },
  });
}

export function useReportComparison(slug: string, id: string | null) {
  return useQuery({
    queryKey: keys.comparison(slug, id ?? ""),
    queryFn: () => api.compareReport(slug, id!),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useArchiveReport(slug: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patchReport(slug, id, { status: "archived" }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.reports(slug) }),
  });
}

export function useRenderReport(slug: string) {
  return useMutation({ mutationFn: (reportId: string) => api.renderReport(slug, reportId) });
}

export function useAnalysisArtifact(slug: string, id: string | null) {
  return useQuery({
    queryKey: keys.artifact(slug, id ?? ""),
    queryFn: () => api.getArtifact(slug, id!),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      ["queued", "running"].includes(query.state.data?.status ?? "") ? 1000 : false,
  });
}

export function useDownloadArtifact(slug: string) {
  return useMutation({
    mutationFn: (artifact: import("./types").ReportArtifact) =>
      api.downloadArtifact(slug, artifact),
  });
}
