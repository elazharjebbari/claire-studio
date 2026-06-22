"use client";

/**
 * Exports EN TÂCHE DE FOND (F5) — on lance un export sans bloquer l'UI : le job apparaît
 * dans l'historique, son statut est suivi par polling adaptatif, et dès qu'il est prêt
 * une notification s'affiche avec le bouton Télécharger. Échec → message + Relancer.
 * Voir docs/pactiva/dossier-export-async/.
 */

import { useEffect, useRef, useState } from "react";
import { Download, RotateCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { createExport, downloadExport } from "@/lib/api/endpoints";
import { useProjectExports, useExportJob, useRetryExport } from "@/lib/api/hooks";
import { useCurrentProjectSlug } from "@/lib/useCurrentProject";
import { Panel, Button } from "@/components/ui/primitives";
import { ExportStatusPill } from "@/components/admin/ExportStatusPill";
import type { ExportFormat, ExportJob } from "@/types/contract";

const FORMATS: Array<{ value: ExportFormat; label: string; explain: string }> = [
  { value: "jsonl", label: "JSONL", explain: "Une annotation pivot par ligne (réimportable)." },
  { value: "csv", label: "CSV", explain: "Tableau clause par ligne (tableur)." },
  { value: "conll", label: "CoNLL", explain: "Colonnes par phrase (segmentation NLP)." },
  { value: "xml", label: "XML", explain: "Structuré (annotation/clause)." },
  { value: "md", label: "Markdown", explain: "Rapport lisible, explicatif." },
  { value: "iaa_matrix", label: "Concordance (IAA)", explain: "Matrice κ pairwise (CSV)." },
];

export default function AdminExports() {
  const [format, setFormat] = useState<ExportFormat>("jsonl");
  const [launching, setLaunching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const projectSlug = useCurrentProjectSlug();
  const qc = useQueryClient();
  const { data: history } = useProjectExports(projectSlug);
  const jobs = history?.results ?? [];

  async function launch() {
    if (!projectSlug || launching) return;
    setLaunching(true);
    try {
      await createExport(projectSlug, { format });
      await qc.invalidateQueries({ queryKey: ["projects", projectSlug, "exports"] });
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-1 text-xl font-semibold text-ink">Exports</h1>
      <p className="mb-4 text-sm text-ink-muted">
        L’export s’exécute <strong className="text-ink">en tâche de fond</strong> : lancez-le,
        continuez à travailler, et téléchargez l’artefact dès qu’il est prêt.
      </p>

      {toast && (
        <div
          data-testid="export-toast"
          role="status"
          aria-live="polite"
          className="mb-4 animate-fade-in rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-ink"
        >
          ✓ {toast}
        </div>
      )}

      <Panel className="p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {FORMATS.map((f) => (
            <label
              key={f.value}
              className={`flex cursor-pointer flex-col gap-0.5 rounded-md border p-2 ${
                format === f.value ? "border-accent bg-accent/10" : "border-line"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="format"
                  data-testid={`format-${f.value}`}
                  checked={format === f.value}
                  onChange={() => setFormat(f.value)}
                />
                <span className="font-medium text-ink">{f.label}</span>
              </span>
              <span className="text-xs text-ink-muted">{f.explain}</span>
            </label>
          ))}
        </div>
        <Button
          variant="primary"
          data-testid="run-export"
          disabled={launching || !projectSlug}
          className="mt-4"
          onClick={launch}
        >
          {launching ? "Lancement…" : "Lancer l’export"}
        </Button>
      </Panel>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Historique
      </h2>
      <Panel className="divide-y divide-line" data-testid="export-history">
        {jobs.map((job) => (
          <ExportRow key={job.id} job={job} slug={projectSlug} onReady={(j) => setToast(`Export ${j.format} prêt — téléchargez-le ci-dessous.`)} />
        ))}
        {jobs.length === 0 && (
          <div className="px-4 py-6 text-sm text-ink-muted">Aucun export pour l’instant.</div>
        )}
      </Panel>
    </div>
  );
}

function ExportRow({
  job,
  slug,
  onReady,
}: {
  job: ExportJob;
  slug: string | undefined;
  onReady: (j: ExportJob) => void;
}) {
  // Polling uniquement tant que le job n'est pas terminal (le hook stoppe seul).
  const live = useExportJob(job.id, job.status === "pending" || job.status === "running");
  const j = live.data ?? job;
  const retry = useRetryExport(slug);
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState<string | null>(null);

  // Notifie UNE fois lors de la transition vers `done`.
  const prev = useRef(j.status);
  useEffect(() => {
    if (prev.current !== "done" && j.status === "done") onReady(j);
    prev.current = j.status;
  }, [j.status, j, onReady]);

  async function dl() {
    setDownloading(true);
    setDlError(null);
    try {
      await downloadExport(j.id, `export_${j.format}_${j.id}`);
    } catch {
      setDlError("Téléchargement impossible — réessayez.");
    } finally {
      setDownloading(false);
    }
  }

  const n = (j.manifest?.n_annotations as number | undefined) ?? undefined;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" data-testid={`export-row-${j.id}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="font-mono text-xs uppercase text-ink">{j.format}</span>
        <ExportStatusPill status={j.status} />
        {n != null && <span className="text-xs text-ink-muted">{n} annotation(s)</span>}
        {j.status === "failed" && j.error && (
          <span className="truncate text-xs text-danger" title={j.error}>
            {j.error}
          </span>
        )}
        {dlError && <span className="text-xs text-danger">{dlError}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {j.status === "done" && (
          <Button variant="primary" data-testid={`download-${j.id}`} disabled={downloading} onClick={dl}>
            <Download size={14} aria-hidden /> {downloading ? "…" : "Télécharger"}
          </Button>
        )}
        {j.status === "failed" && (
          <Button
            variant="outline"
            data-testid={`retry-${j.id}`}
            disabled={retry.isPending}
            onClick={() => retry.mutate(j.id)}
          >
            <RotateCw size={14} aria-hidden /> Relancer
          </Button>
        )}
      </div>
    </div>
  );
}
