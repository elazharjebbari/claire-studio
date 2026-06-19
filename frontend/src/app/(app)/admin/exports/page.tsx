"use client";

/** Exports multi-format (F5) — fonctionnel : lance un export et affiche le résultat. */

import { useState } from "react";
import { createExport } from "@/lib/api/endpoints";
import { useCurrentProjectSlug } from "@/lib/useCurrentProject";
import { Panel, Button } from "@/components/ui/primitives";
import type { ExportFormat, ExportJob } from "@/types/contract";

const FORMATS: Array<{ value: ExportFormat; label: string; explain: string }> = [
  { value: "jsonl", label: "JSONL", explain: "Une annotation pivot par ligne (réimportable)." },
  { value: "csv", label: "CSV", explain: "Tableau clause par ligne (tableur)." },
  { value: "conll", label: "CoNLL", explain: "Annotation par token (NER-like)." },
  { value: "xml", label: "XML", explain: "Format aligné CLAUDETTE d'origine." },
  { value: "md", label: "Markdown", explain: "Rapport lisible, explicatif." },
  { value: "huggingface", label: "HuggingFace", explain: "Dataset prêt pour le hub." },
];

export default function AdminExports() {
  const [format, setFormat] = useState<ExportFormat>("jsonl");
  const [job, setJob] = useState<ExportJob | null>(null);
  const [loading, setLoading] = useState(false);
  // Projet courant — plus de slug en dur (H2). TODO chantier G : sélecteur de projet.
  const projectSlug = useCurrentProjectSlug();

  async function runExport() {
    if (!projectSlug) return;
    setLoading(true);
    try {
      const result = await createExport(projectSlug, { format });
      setJob(result);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-1 text-xl font-semibold text-ink">Exports</h1>
      <p className="mb-4 text-sm text-ink-muted">
        Formats explicatifs (F5). L’export produit un artefact + un manifeste.
      </p>

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
          disabled={loading || !projectSlug}
          className="mt-4"
          onClick={runExport}
        >
          {loading ? "Export en cours…" : "Lancer l’export"}
        </Button>

        {job && (
          <div
            data-testid="export-result"
            className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm"
          >
            <p className="font-medium text-ink">
              Export {job.format} · {job.status}
            </p>
            <p className="text-ink-muted">Artefact : {job.artifactPath}</p>
            {job.manifest && (
              <pre className="mt-1 overflow-auto text-xs text-ink-muted">
                {JSON.stringify(job.manifest, null, 2)}
              </pre>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
