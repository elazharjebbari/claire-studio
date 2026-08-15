"use client";

/**
 * Contenus PAR FAMILLE de vue (docs/pactiva-lab-resultats/04 §4) : le verdict — LA
 * réponse à la question décisionnelle du preset — et la grille de KPIs adaptée à la
 * tâche. La page reste assemblée par `RunResults` (contrat de page commun) ; ici ne
 * vit que ce qui change d'une famille à l'autre.
 *
 * Les plafonds de référence diffèrent PAR TÂCHE (κ 0,769 / α-MASI 0,635 / Jaccard
 * 0,39–0,63) — une vue générique avec « le » plafond serait fausse par construction
 * pour deux tâches sur trois (dossier 02 §3).
 */

import { Panel } from "@/components/ui/primitives";

import { MetricCell } from "./resultComponents";
import { fmtCeilingShare, fmtCi, fmtMetric, fmtSigned } from "./resultFormat";
import type { ViewFamily } from "./resultView";
import type { LabTask, RunDetail } from "./types";

/** Références publiées par tâche (plan scientifique §1-2 — mesures du papier court). */
export const TASK_REFERENCES: Record<
  LabTask,
  { label: string; text: string }
> = {
  T1_primary: {
    label: "Accord humain de référence",
    text: "κ = 0,769 entre annotateurs — l'unité de comparaison directe humains / supervisé / juges LLM.",
  },
  T2_multilabel: {
    label: "Plafond multi-étiquettes",
    text: "α-MASI = 0,635 entre annotateurs — l'accord multi-étiquettes est plus dur : c'est LUI le plafond de référence en T2, pas κ.",
  },
  T3_boundary: {
    label: "Accord humain sur les frontières",
    text: "Jaccard 0,39 – 0,63 selon les paires d'annotateurs — une FOURCHETTE, pas un point ; échelle différente de WindowDiff : repère, pas comparaison directe.",
  },
};

/** Bande de référence publiée par tâche — complète (sans remplacer) le plafond calculé
 * sur le dataset du run. */
export function TaskReferenceBand({ task }: { task: LabTask }) {
  const reference = TASK_REFERENCES[task];
  if (!reference) return null;
  return (
    <div
      className="rounded-md border border-line bg-panel-muted px-3 py-2 text-xs text-ink-muted"
      data-testid="task-reference-band"
    >
      <span className="font-medium text-ink">{reference.label} :</span> {reference.text}
    </div>
  );
}

type Num = number | null;

function num(value: unknown): Num {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

/**
 * La phrase du verdict — générée depuis les données, formulations verrouillées
 * (dossier 05 §4). Renvoie null quand les données ne permettent aucun verdict honnête
 * (la page affiche alors les KPIs sans phrase, jamais une phrase inventée).
 */
export function buildVerdict(run: RunDetail, family: ViewFamily): string | null {
  const metrics = run.metrics?.metrics ?? {};
  const macroF1 = num(metrics.macroF1);
  const ciText = fmtCi(run.metrics?.metrics?.macroF1Ci) ?? "";
  const ceiling = run.metrics?.humanCeiling?.value ?? null;

  switch (family) {
    case "floor": {
      if (macroF1 == null) return null;
      const kind = run.preset === "position-only" ? "positionnel" : "TF-IDF";
      return (
        `Le plancher ${kind} est à ${fmtMetric(macroF1)}${ciText ? ` ${ciText}` : ""} de ` +
        "macro-F1. Tout modèle sérieux doit le dépasser nettement — sans ce plancher, " +
        "aucun gain n'est interprétable."
      );
    }
    case "flagship":
    case "generic": {
      if (macroF1 == null) return null;
      const share = fmtCeilingShare(macroF1, ceiling);
      return (
        `macro-F1 ${fmtMetric(macroF1)}${ciText ? ` ${ciText}` : ""}` +
        (share ? ` — soit ${share}.` : ".")
      );
    }
    case "multilabel": {
      const micro = num(metrics.microF1);
      const lrap = num(metrics.lrap);
      if (macroF1 == null || micro == null) return null;
      const gap = micro - macroF1;
      return (
        `micro-F1 ${fmtMetric(micro)} ; macro-F1 ${fmtMetric(macroF1)}` +
        `${ciText ? ` ${ciText}` : ""} ; écart micro−macro ${fmtSigned(gap)} — le point ` +
        `de rigueur : les thèmes rares restent fragiles, le papier le documente au lieu ` +
        `de le cacher.${lrap != null ? ` LRAP ${fmtMetric(lrap)}.` : ""} Plafond de ` +
        `référence : α-MASI 0,635.`
      );
    }
    case "boundary": {
      const windowDiff = num(metrics.windowDiff);
      if (windowDiff == null) return null;
      return (
        `WindowDiff ${fmtMetric(windowDiff)} (plus bas = mieux). Référence humaine : ` +
        `accord Jaccard entre annotateurs 0,39 – 0,63 — une fourchette, et une échelle ` +
        `différente : repère, pas comparaison directe.`
      );
    }
    default:
      // Les familles agrégées (paired/screening/curve/judges) portent leur verdict au
      // niveau de l'EXPÉRIENCE (lot L4) — un run isolé garde la lecture flagship.
      return buildVerdict(run, "flagship");
  }
}

/** Grille de KPIs adaptée à la famille — chaque cellule porte IC/dispersion/définition. */
export function FamilyKpis({ run, family }: { run: RunDetail; family: ViewFamily }) {
  const metrics = run.metrics?.metrics ?? {};
  const foldStats = metrics.foldStats ?? {};
  const macroCell = (
    <MetricCell
      label="macro-F1"
      value={num(metrics.macroF1)}
      ci={metrics.macroF1Ci}
      dispersion={foldStats.macroF1?.std}
      definitionKey="macroF1"
      testId="kpi-macro-f1"
    />
  );

  if (family === "multilabel") {
    const micro = num(metrics.microF1);
    const macro = num(metrics.macroF1);
    return (
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="run-metrics-kpis">
        <MetricCell
          label="micro-F1"
          value={micro}
          dispersion={foldStats.microF1?.std}
          definitionKey="microF1"
          testId="kpi-micro-f1"
        />
        {macroCell}
        <MetricCell
          label="écart micro−macro"
          value={micro != null && macro != null ? micro - macro : null}
          definitionKey="microF1"
          hint="le point de rigueur"
          testId="kpi-micro-macro-gap"
        />
        <MetricCell
          label="LRAP"
          value={num(metrics.lrap)}
          dispersion={foldStats.lrap?.std}
          definitionKey="lrap"
          testId="kpi-lrap"
        />
        <MetricCell
          label="Hamming loss"
          value={num(metrics.hammingLoss)}
          definitionKey="hammingLoss"
          hint="plus bas = mieux"
          testId="kpi-hamming"
        />
        <MetricCell
          label="Subset accuracy"
          value={num(metrics.subsetAccuracy)}
          definitionKey="subsetAccuracy"
          testId="kpi-subset"
        />
      </dl>
    );
  }

  if (family === "boundary") {
    return (
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="run-metrics-kpis">
        <MetricCell
          label="WindowDiff"
          value={num(metrics.windowDiff)}
          dispersion={foldStats.windowDiff?.std}
          definitionKey="windowDiff"
          hint="plus bas = mieux"
          testId="kpi-window-diff"
        />
        <MetricCell
          label="Précision frontière"
          value={num(metrics.boundaryPrecision)}
          testId="kpi-boundary-precision"
        />
        <MetricCell
          label="Rappel frontière"
          value={num(metrics.boundaryRecall)}
          testId="kpi-boundary-recall"
        />
        <MetricCell
          label="F1 frontière"
          value={num(metrics.macroF1)}
          ci={metrics.macroF1Ci}
          dispersion={foldStats.macroF1?.std}
          testId="kpi-boundary-f1"
        />
      </dl>
    );
  }

  // floor / flagship / generic (et le repli des familles agrégées sur un run isolé) :
  // la grille T1 — macro (avec IC), micro, κ, ECE.
  const kappa = num(metrics.kappa);
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="run-metrics-kpis">
      {macroCell}
      <MetricCell
        label="micro-F1"
        value={num(metrics.microF1)}
        dispersion={foldStats.microF1?.std}
        definitionKey="microF1"
        testId="kpi-micro-f1"
      />
      {kappa != null && (
        <MetricCell
          label="κ"
          value={kappa}
          dispersion={foldStats.kappa?.std}
          definitionKey="kappa"
          testId="kpi-kappa"
        />
      )}
      <MetricCell label="ECE" value={num(metrics.ece)} definitionKey="ece" testId="kpi-ece" />
    </dl>
  );
}

/**
 * Taux d'erreur par classe d'accord — la lecture la plus instructive du résultat
 * principal : le modèle échoue-t-il là où les humains divergent aussi ?
 */
export function ByAgreementClassPanel({ run }: { run: RunDetail }) {
  const byClass = run.metrics?.errors?.byAgreementClass;
  if (!byClass || Object.keys(byClass).length === 0) return null;
  const ORDER = ["strict", "majority", "divergence"];
  const LABELS: Record<string, string> = {
    strict: "strict", majority: "majorité", divergence: "divergence", unknown: "inconnu",
  };
  const entries = Object.entries(byClass).sort(
    (a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]),
  );
  const max = Math.max(...entries.map(([, s]) => s.rate ?? 0), 0.001);
  return (
    <Panel className="p-4" data-testid="by-agreement-panel">
      <h3 className="text-sm font-semibold text-ink">Erreurs par classe d&apos;accord humain</h3>
      <p className="mt-1 text-xs text-ink-muted">
        Un modèle qui n&apos;échoue que là où les humains divergent aussi a, en pratique,
        atteint le plafond.
      </p>
      <div className="mt-3 space-y-2">
        {entries.map(([klass, stats]) => (
          <div key={klass} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 text-ink">{LABELS[klass] ?? klass}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-muted">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${((stats.rate ?? 0) / max) * 100}%` }}
              />
            </div>
            <span className="w-28 shrink-0 text-right font-mono text-ink">
              {stats.rate == null ? "—" : `${(stats.rate * 100).toFixed(1)} %`}{" "}
              <span className="text-ink-muted">({stats.errors}/{stats.n})</span>
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
