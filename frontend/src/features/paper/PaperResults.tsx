"use client";

/**
 * « Résultats pour l'article » — la vue qui organise la campagne expérimentale finale.
 *
 * Trois principes de conception :
 *
 * 1. **Aucun chiffre saisi à la main.** Tout vient de `campaign.json`, produit par
 *    `research/experiments/run_campaign.py`. Chaque valeur affichée porte sa provenance :
 *    expérience, dataset, taxonomie, population, version du code, date d'exécution.
 * 2. **Le statut est DÉDUIT, jamais déclaré.** Des portes de contrôle automatiques
 *    (gold figé, dataset figé, découpe par document, absence de fuite, mappings figés,
 *    graine enregistrée) décident si un résultat est citable. Une porte en échec est
 *    affichée avec sa raison — on ne peut pas publier sans l'avoir vue.
 * 3. **Le mode « prêt pour l'article » masque le reste.** Il ne montre que les résultats
 *    validés et propose leur export — c'est le garde-fou contre le mélange involontaire
 *    d'un aperçu et d'un chiffre publié.
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCode2,
  FileSpreadsheet,
  FlaskConical,
  Info,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Button, Panel } from "@/components/ui/primitives";
import { Disclosure } from "@/components/ui/Disclosure";
import campaignData from "./campaign.json";
import {
  STATUS_META,
  isPaperReady,
  type Campaign,
  type ExperimentStatus,
  type Gate,
  type PaperExperiment,
  type PaperMetric,
} from "./types";
import {
  download,
  experimentToLatex,
  experimentsToJson,
  formatValue,
  inlineValuesToLatex,
  metricsToCsv,
  rqToLatex,
} from "./export";
import { ExperimentDetail } from "./ExperimentDetail";

const campaign = campaignData as unknown as Campaign;

export function PaperResults() {
  const [rq, setRq] = useState<string>("RQ1");
  const [paperReadyOnly, setPaperReadyOnly] = useState(false);
  const [taxonomyFilter, setTaxonomyFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const rqs = useMemo(
    () => [...new Set(campaign.experiments.map((e) => e.rq))].sort(),
    [],
  );
  const taxonomies = useMemo(
    () => [...new Set(campaign.experiments.map((e) => e.data.taxonomy).filter(Boolean))] as string[],
    [],
  );

  const visible = useMemo(
    () =>
      campaign.experiments.filter(
        (e) =>
          e.rq === rq &&
          (!paperReadyOnly || isPaperReady(e)) &&
          (taxonomyFilter === "all" || e.data.taxonomy === taxonomyFilter),
      ),
    [rq, paperReadyOnly, taxonomyFilter],
  );

  const ready = campaign.experiments.filter(isPaperReady);
  const blocked = campaign.experiments.filter((e) => !isPaperReady(e));
  const blockingGates = new Map<string, string[]>();
  for (const e of blocked) {
    for (const g of e.gates) {
      if (g.blocking && !g.passed) {
        blockingGates.set(g.id, [...(blockingGates.get(g.id) ?? []), e.id]);
      }
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="paper-results">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-ink">
            <FlaskConical size={18} className="text-accent" aria-hidden />
            Résultats pour l&apos;article
          </h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Campagne v{campaign.campaignVersion} · {campaign.experiments.length} expériences ·
            dataset <span className="font-mono">{campaign.dataset.fingerprint?.slice(0, 16)}…</span>{" "}
            ({campaign.dataset.documents} documents, {campaign.dataset.sentences} phrases,{" "}
            {campaign.dataset.annotations} annotations)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            data-testid="paper-ready-count"
            className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[12px] font-medium text-success"
          >
            {ready.length} citable(s)
          </span>
          {blocked.length > 0 && (
            <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[12px] font-medium text-warning">
              {blocked.length} en attente
            </span>
          )}
        </div>
      </header>

      {/* Ce qui empêche les résultats restants d'être citables — nommé, pas caché. */}
      {blockingGates.size > 0 && (
        <div
          data-testid="paper-blockers"
          className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[13px] text-warning"
        >
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            <AlertTriangle size={14} aria-hidden /> Ce qui bloque encore
          </div>
          <ul className="flex flex-col gap-0.5">
            {[...blockingGates.entries()].map(([gateId, ids]) => {
              const gate = blocked
                .flatMap((e) => e.gates)
                .find((g) => g.id === gateId);
              return (
                <li key={gateId} data-testid={`paper-blocker-${gateId}`}>
                  <strong>{gate?.label ?? gateId}</strong> — {gate?.detail}{" "}
                  <span className="opacity-80">({ids.join(", ")})</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Question de recherche" className="flex rounded-md border border-line p-0.5">
          {rqs.map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={rq === id}
              data-testid={`paper-rq-${id}`}
              onClick={() => setRq(id)}
              className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
                rq === id ? "bg-accent text-accent-fg" : "text-ink-muted hover:bg-panel-muted"
              }`}
              title={campaign.rqLabels[id]}
            >
              {id}
            </button>
          ))}
        </div>
        <select
          data-testid="paper-taxonomy-filter"
          value={taxonomyFilter}
          onChange={(e) => setTaxonomyFilter(e.target.value)}
          className="rounded-md border border-line bg-panel px-2 py-1 text-[12px] text-ink"
          aria-label="Filtrer par taxonomie"
        >
          <option value="all">Toutes taxonomies</option>
          {taxonomies.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[12px] text-ink">
          <input
            type="checkbox"
            data-testid="paper-ready-toggle"
            checked={paperReadyOnly}
            onChange={(e) => setPaperReadyOnly(e.target.checked)}
          />
          Mode « prêt pour l&apos;article » (citables seulement)
        </label>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="subtle"
            data-testid="paper-export-csv"
            onClick={() => download("pactiva-resultats.csv", metricsToCsv(visible), "text/csv")}
          >
            <FileSpreadsheet size={13} aria-hidden /> CSV
          </Button>
          <Button
            variant="subtle"
            data-testid="paper-export-json"
            onClick={() => download("pactiva-resultats.json", experimentsToJson(visible), "application/json")}
          >
            <Download size={13} aria-hidden /> JSON
          </Button>
          <Button
            variant="subtle"
            data-testid="paper-export-latex"
            onClick={() =>
              download(
                `pactiva-${rq.toLowerCase()}.tex`,
                [
                  rqToLatex(rq, campaign.rqLabels[rq] ?? rq, visible),
                  "",
                  ...visible.map(experimentToLatex),
                  "",
                  inlineValuesToLatex(visible),
                ].join("\n\n"),
                "text/x-tex",
              )
            }
          >
            <FileCode2 size={13} aria-hidden /> LaTeX
          </Button>
        </div>
      </div>

      <h2 className="text-[15px] font-semibold text-ink">
        {rq} — {campaign.rqLabels[rq]}
      </h2>

      {visible.length === 0 && (
        <p className="text-[13px] text-ink-muted" data-testid="paper-empty">
          Aucune expérience ne correspond à ces filtres.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {visible.map((experiment) => (
          <ExperimentCard
            key={experiment.id}
            experiment={experiment}
            open={openId === experiment.id}
            onToggle={() => setOpenId(openId === experiment.id ? null : experiment.id)}
          />
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ExperimentStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      data-testid={`paper-status-${status}`}
      title={meta.hint}
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

function GateList({ gates }: { gates: Gate[] }) {
  return (
    <ul className="flex flex-col gap-1" data-testid="paper-gates">
      {gates.map((gate) => (
        <li key={gate.id} className="flex items-start gap-1.5 text-[12px]">
          {gate.passed ? (
            <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success" aria-hidden />
          ) : (
            <XCircle
              size={13}
              className={`mt-0.5 shrink-0 ${gate.blocking ? "text-danger" : "text-warning"}`}
              aria-hidden
            />
          )}
          <span className={gate.passed ? "text-ink-muted" : "text-ink"}>
            <strong>{gate.label}</strong>
            {gate.blocking ? "" : " (non bloquante)"} — {gate.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MetricRow({ metric }: { metric: PaperMetric }) {
  return (
    <tr className="border-t border-line">
      <td className="py-1 pr-3 text-[13px] text-ink">{metric.label}</td>
      <td className="py-1 pr-3 text-right font-mono text-[13px] text-ink">
        {formatValue(metric.value)}
        {metric.unit === "part" && typeof metric.value === "number" && (
          <span className="ml-1 text-[11px] text-ink-muted">
            ({(metric.value * 100).toFixed(1)} %)
          </span>
        )}
      </td>
      <td className="py-1 text-right font-mono text-[12px] text-ink-muted">
        {metric.ci ? `[${metric.ci[0].toFixed(4)} ; ${metric.ci[1].toFixed(4)}]` : "—"}
      </td>
      <td className="py-1 pl-3 text-[11px] text-ink-muted">{metric.note}</td>
    </tr>
  );
}

function ExperimentCard({
  experiment,
  open,
  onToggle,
}: {
  experiment: PaperExperiment;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Panel>
      <div className="flex flex-col gap-2" data-testid={`paper-exp-${experiment.id}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[12px] text-ink-muted">{experiment.id}</span>
          <h3 className="text-[14px] font-semibold text-ink">{experiment.title}</h3>
          <StatusBadge status={experiment.status} />
          {experiment.data.taxonomy && (
            <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
              {experiment.data.taxonomy}
            </span>
          )}
          <button
            type="button"
            data-testid={`paper-toggle-${experiment.id}`}
            onClick={onToggle}
            className="ml-auto text-[12px] text-accent underline-offset-2 hover:underline"
          >
            {open ? "Replier" : "Détail, protocole et provenance"}
          </button>
        </div>

        <p className="text-[13px] text-ink">{experiment.summary}</p>

        <table className="w-full">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-ink-muted">
              <th className="pb-1 text-left font-medium">Métrique</th>
              <th className="pb-1 text-right font-medium">Valeur</th>
              <th className="pb-1 text-right font-medium">IC 95 %</th>
              <th className="pb-1 pl-3 text-left font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {experiment.metrics.map((m) => (
              <MetricRow key={m.key} metric={m} />
            ))}
          </tbody>
        </table>

        {open && <ExperimentDetail experiment={experiment} />}

        {!open && (
          <Disclosure
            testId={`paper-gates-${experiment.id}`}
            icon={<ShieldCheck size={13} aria-hidden />}
            summary={`Contrôles de validité (${experiment.gates.filter((g) => g.passed).length}/${experiment.gates.length})`}
          >
            <GateList gates={experiment.gates} />
          </Disclosure>
        )}
      </div>
    </Panel>
  );
}

export { GateList, StatusBadge, MetricRow, Info };
