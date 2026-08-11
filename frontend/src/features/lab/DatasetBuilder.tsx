"use client";

/**
 * Construction d'un jeu de données : critères à gauche, aperçu en temps réel à droite.
 *
 * L'aperçu (`preflight`) se met à jour à CHAQUE changement, avant toute construction.
 * C'est le principe d'ergonomie central du Lab : on ne découvre pas après coup qu'un
 * dataset a perdu douze documents. Et le bouton, quand il est désactivé, dit pourquoi —
 * la même règle que le bouton de validation de l'atelier.
 */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Database, Loader2 } from "lucide-react";

import { Button, Panel } from "@/components/ui/primitives";

import { buildDataset, preflight, type DatasetCriteria } from "./api";
import type { PreflightReport } from "./types";

const MATURITIES = [
  { value: "complete", label: "Complètes", hint: "toutes les phrases validées, quel que soit le statut" },
  { value: "submitted", label: "Soumises", hint: "conforme au workflow" },
  { value: "gold", label: "Gold finalisé", hint: "l'étalon arbitré" },
  { value: "any", label: "Toutes", hint: "exploration seulement" },
] as const;

const AGGREGATIONS = [
  { value: "consensus", label: "Consensus", hint: "cascade de résolution (accord strict / majorité)" },
  { value: "soft", label: "Soft labels", hint: "distribution des votes préservée" },
  { value: "single", label: "Un annotateur", hint: "corpus mono-annoté" },
] as const;

export function DatasetBuilder({
  slug,
  initialMinAnnotators,
}: {
  slug: string;
  /** Pré-rempli depuis le lien « Documents à ≥N annotateurs » du bandeau « Prêt pour la
   * science » — sans ça, l'utilisateur devrait deviner la même valeur au clavier. */
  initialMinAnnotators?: number;
}) {
  const [criteria, setCriteria] = useState<DatasetCriteria>({
    maturity: "complete",
    aggregation: "consensus",
    completenessThreshold: 1.0,
    minAnnotators: initialMinAnnotators ?? 0,
    excludePartial: true,
    k: 5,
  });
  const [report, setReport] = useState<PreflightReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // L'aperçu suit les critères. Le délai évite d'interroger le serveur à chaque frappe
  // sur le curseur de complétude.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      preflight(slug, criteria)
        .then((result) => {
          if (!cancelled) setReport(result);
        })
        .catch(() => {
          if (!cancelled) setReport(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, criteria]);

  const blockingReason = useMemo(() => {
    if (!report) return "aperçu indisponible";
    if (report.nAnnotations === 0) return "aucune annotation ne satisfait ces critères";
    if (!report.splitsPreview.feasible)
      return `${report.nDocuments} document(s) pour ${report.splitsPreview.k} plis : découpage impossible`;
    return null;
  }, [report]);

  const onBuild = async () => {
    setBuilding(true);
    setMessage(null);
    try {
      const dataset = await buildDataset(slug, criteria);
      setMessage(`Jeu de données construit : ${dataset.fingerprint.slice(0, 12)}…`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "échec de la construction");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]" data-testid="dataset-builder">
      <Panel className="space-y-4 p-4">
        <h3 className="text-sm font-semibold text-ink">Critères</h3>

        <fieldset>
          <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Maturité des annotations
          </legend>
          {MATURITIES.map((option) => (
            <label key={option.value} className="mb-1 flex items-start gap-2 text-xs">
              <input
                type="radio"
                name="maturity"
                className="mt-0.5"
                checked={criteria.maturity === option.value}
                onChange={() => setCriteria((c) => ({ ...c, maturity: option.value }))}
              />
              <span>
                <span className="text-ink">{option.label}</span>
                <span className="block text-[10px] text-ink-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Agrégation
          </legend>
          {AGGREGATIONS.map((option) => (
            <label key={option.value} className="mb-1 flex items-start gap-2 text-xs">
              <input
                type="radio"
                name="aggregation"
                className="mt-0.5"
                checked={criteria.aggregation === option.value}
                onChange={() => setCriteria((c) => ({ ...c, aggregation: option.value }))}
              />
              <span>
                <span className="text-ink">{option.label}</span>
                <span className="block text-[10px] text-ink-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="block text-xs">
          <span className="text-ink-muted">
            Seuil de complétude : {Math.round((criteria.completenessThreshold ?? 1) * 100)} %
          </span>
          <input
            type="range"
            min={0.8}
            max={1}
            step={0.01}
            className="mt-1 w-full"
            value={criteria.completenessThreshold ?? 1}
            onChange={(e) =>
              setCriteria((c) => ({ ...c, completenessThreshold: Number(e.target.value) }))
            }
            data-testid="completeness-slider"
          />
          <span className="block text-[10px] text-ink-muted">
            Sous 100 %, une annotation finie à un clic près (192/193) est récupérée. La
            tolérance est tracée dans le manifeste.
          </span>
        </label>

        <label className="block text-xs">
          <span className="text-ink-muted">Annotateurs minimum par document</span>
          <input
            type="number"
            min={0}
            max={5}
            className="mt-1 w-full rounded border border-line bg-panel-muted px-2 py-1 text-ink"
            value={criteria.minAnnotators ?? 0}
            onChange={(e) => setCriteria((c) => ({ ...c, minAnnotators: Number(e.target.value) }))}
          />
        </label>

        <Button
          onClick={onBuild}
          disabled={Boolean(blockingReason)}
          loading={building}
          icon={<Database size={14} aria-hidden />}
          // Un bouton grisé sans explication se lit comme une panne : on dit pourquoi.
          title={blockingReason ?? "Construire le jeu de données figé"}
          data-testid="dataset-build"
        >
          Construire
        </Button>
        {blockingReason && (
          <p className="text-[11px] text-danger" data-testid="dataset-blocked">
            {blockingReason}
          </p>
        )}
        {message && <p className="text-[11px] text-ink-muted">{message}</p>}
      </Panel>

      <Panel className="p-4" data-testid="preflight-report">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Aperçu (rien n&apos;est créé)</h3>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-muted" aria-hidden />}
        </div>

        {!report ? (
          <p className="text-xs text-ink-muted">Aperçu indisponible.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
              <Stat label="Annotations" value={report.nAnnotations} />
              <Stat label="Documents" value={report.nDocuments} />
              <Stat label="Phrases" value={report.nSentences} />
              <Stat label="Thèmes" value={Object.keys(report.labelDistribution).length} />
              <Stat label="≥2 annotateurs" value={report.nMultiAnnotated} />
              <Stat label="≥3 annotateurs" value={report.nTripleAnnotated} />
              <Stat
                label="Plis"
                value={report.splitsPreview.feasible ? report.splitsPreview.k : "—"}
              />
              <Stat label="Empreinte" value={report.wouldFingerprint.slice(0, 8)} mono />
            </dl>

            {report.warnings.length > 0 && (
              <ul className="mt-3 space-y-1" data-testid="preflight-warnings">
                {report.warnings.map((warning) => (
                  <li key={warning.code} className="flex items-start gap-1.5 text-[11px]">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" aria-hidden />
                    <span className="text-ink-muted">{warning.message}</span>
                  </li>
                ))}
              </ul>
            )}

            {report.excluded.length > 0 && (
              <div className="mt-3" data-testid="preflight-excluded">
                <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  Écartés ({report.excluded.length}) — avec le motif
                </h4>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-ink-muted">
                      <th scope="col" className="py-0.5 text-left">Document</th>
                      <th scope="col" className="py-0.5 text-left">Annotateur</th>
                      <th scope="col" className="py-0.5 text-left">Motif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.excluded.slice(0, 12).map((row, index) => (
                      <tr key={index} className="border-t border-line">
                        <td className="py-0.5 text-ink">{row.document ?? "—"}</td>
                        <td className="py-0.5 text-ink-muted">{row.annotator ?? "—"}</td>
                        <td className="py-0.5 text-ink-muted">{row.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.excluded.length > 12 && (
                  <p className="mt-1 text-[10px] text-ink-muted">
                    … et {report.excluded.length - 12} autres.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className={mono ? "font-mono text-sm text-ink" : "text-sm font-semibold text-ink"}>
        {value}
      </dd>
    </div>
  );
}
