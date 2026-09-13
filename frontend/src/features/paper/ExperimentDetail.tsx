"use client";

/**
 * Détail d'une expérience — la couche qui permet de COMPRENDRE un chiffre, pas seulement
 * de le lire : question, hypothèse, protocole, incertitude, interprétation, limites,
 * contrôles de validité, provenance complète, et drill-down vers ce qui explique le
 * résultat (détail par thème, matrice d'accord, erreurs représentatives).
 *
 * Le drill-down est la pièce qui rend la vue défendable : un relecteur qui doute d'un
 * chiffre doit pouvoir descendre jusqu'aux thèmes, aux paires d'annotateurs ou aux phrases
 * qui le produisent, sans quitter l'écran.
 */

import {
  BookOpen,
  GitBranch,
  Layers,
  ListTree,
  Microscope,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Disclosure } from "@/components/ui/Disclosure";
import { presentTheme } from "@/lib/taxonomy/presentation";
import type { TaxonomyId } from "@/lib/taxonomy";
import type { PaperExperiment } from "./types";
import { experimentToLatex } from "./export";

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
        {icon}
        {title}
      </div>
      <div className="text-[13px] text-ink">{children}</div>
    </div>
  );
}

/** Détail par thème : ce qui explique une moyenne (α global, macro-F1…). */
function PerThemeTable({
  rows,
  taxonomy,
}: {
  rows: Array<Record<string, unknown>>;
  taxonomy: TaxonomyId;
}) {
  const keys = Object.keys(rows[0] ?? {}).filter((k) => k !== "theme" && k !== "label");
  return (
    <div className="max-h-80 overflow-auto" data-testid="paper-per-theme">
      <table className="w-full">
        <thead className="sticky top-0 bg-panel">
          <tr className="text-[11px] uppercase tracking-wide text-ink-muted">
            <th className="pb-1 text-left font-medium">Classe</th>
            {keys.map((k) => (
              <th key={k} className="pb-1 pl-3 text-right font-medium">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const code = String(row.theme ?? row.label ?? i);
            const p = presentTheme(code, taxonomy);
            return (
              <tr key={code} className="border-t border-line">
                <td className="py-1 text-[12px]">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: p.color }}
                      aria-hidden
                    />
                    <span className="text-ink">{p.label}</span>
                  </span>
                </td>
                {keys.map((k) => (
                  <td key={k} className="py-1 pl-3 text-right font-mono text-[12px] text-ink-muted">
                    {typeof row[k] === "number" ? (row[k] as number).toFixed(4) : String(row[k] ?? "—")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Matrice d'accord annotateurs × juges — la structure, pas seulement le minimum/maximum. */
function AgreementMatrix({
  actors,
  kinds,
  matrix,
}: {
  actors: string[];
  kinds: Record<string, string>;
  matrix: Array<Array<number | null>>;
}) {
  const scale = (v: number | null) => {
    if (v === null) return "transparent";
    // Échelle continue : plus l'accord est fort, plus la cellule est saturée.
    const clamped = Math.max(0, Math.min(1, v));
    return `color-mix(in srgb, var(--color-success) ${Math.round(clamped * 70)}%, transparent)`;
  };
  return (
    <div className="overflow-auto" data-testid="paper-agreement-matrix">
      <table className="text-[11px]">
        <thead>
          <tr>
            <th />
            {actors.map((a) => (
              <th key={a} className="px-1 pb-1 text-left font-medium text-ink-muted">
                <span className={kinds[a] === "judge" ? "italic" : ""}>{a.slice(0, 10)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={actors[i]}>
              <th className="pr-2 text-right font-medium text-ink-muted">
                <span className={kinds[actors[i]!] === "judge" ? "italic" : ""}>
                  {actors[i]!.slice(0, 14)}
                </span>
              </th>
              {row.map((value, j) => (
                <td
                  key={j}
                  title={`${actors[i]} ↔ ${actors[j]} : κ = ${value ?? "—"}`}
                  className="border border-line px-1.5 py-1 text-center font-mono text-ink"
                  style={{ backgroundColor: i === j ? "transparent" : scale(value) }}
                >
                  {i === j ? "—" : value?.toFixed(2) ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-ink-muted">
        En italique : les juges LLM. La saturation suit la valeur du κ.
      </p>
    </div>
  );
}

/** Erreurs représentatives : le drill-down jusqu'à la phrase. */
function ErrorSamples({ rows }: { rows: Array<Record<string, unknown>> }) {
  return (
    <div className="max-h-80 overflow-auto" data-testid="paper-error-samples">
      <table className="w-full">
        <thead className="sticky top-0 bg-panel">
          <tr className="text-[11px] uppercase tracking-wide text-ink-muted">
            <th className="pb-1 text-left font-medium">Document</th>
            <th className="pb-1 pl-2 text-right font-medium">Phrase</th>
            <th className="pb-1 pl-3 text-left font-medium">Attendu</th>
            <th className="pb-1 pl-3 text-left font-medium">Prédit</th>
            <th className="pb-1 pl-3 text-right font-medium">Confiance</th>
            <th className="pb-1 pl-3 text-left font-medium">Accord</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-line text-[12px]">
              <td className="py-1 font-mono text-ink">{String(row.document)}</td>
              <td className="py-1 pl-2 text-right font-mono text-ink-muted">{String(row.index)}</td>
              <td className="py-1 pl-3 text-success">{String(row.y_true)}</td>
              <td className="py-1 pl-3 text-danger">{String(row.y_pred)}</td>
              <td className="py-1 pl-3 text-right font-mono text-ink-muted">
                {typeof row.confidence === "number" ? row.confidence.toFixed(3) : "—"}
              </td>
              <td className="py-1 pl-3 text-ink-muted">{String(row.agreement ?? "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExperimentDetail({ experiment }: { experiment: PaperExperiment }) {
  const results = experiment.results as Record<string, unknown>;
  const taxonomy = (experiment.data.taxonomy?.startsWith("T")
    ? (experiment.data.taxonomy.split(/[^A-Z0-9]/)[0] as TaxonomyId)
    : "T20") as TaxonomyId;

  const perTheme = (results.perTheme ?? results.perLabel) as
    | Array<Record<string, unknown>>
    | undefined;
  const matrix = results.matrix as Array<Array<number | null>> | undefined;
  const errorSamples = results.lowestConfidenceErrors as
    | Array<Record<string, unknown>>
    | undefined;

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3" data-testid="paper-detail">
      <Section title="Question scientifique" icon={<BookOpen size={12} aria-hidden />}>
        {experiment.question}
      </Section>
      <Section title="Hypothèse" icon={<Microscope size={12} aria-hidden />}>
        {experiment.hypothesis}
      </Section>
      <Section title="Protocole" icon={<ListTree size={12} aria-hidden />}>
        {experiment.protocol}
      </Section>
      <Section title="Incertitude">{experiment.uncertainty}</Section>
      <Section title="Interprétation">{experiment.interpretation}</Section>

      {experiment.limits.length > 0 && (
        <Section title="Limites" icon={<TriangleAlert size={12} aria-hidden />}>
          <ul className="list-disc pl-4">
            {experiment.limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Drill-down : ce qui explique le chiffre. */}
      {perTheme && perTheme.length > 0 && (
        <Disclosure
          testId={`paper-drill-theme-${experiment.id}`}
          icon={<Layers size={13} aria-hidden />}
          summary={`Détail par classe (${perTheme.length})`}
        >
          <PerThemeTable rows={perTheme} taxonomy={taxonomy} />
        </Disclosure>
      )}

      {matrix && (
        <Disclosure
          testId={`paper-drill-matrix-${experiment.id}`}
          icon={<GitBranch size={13} aria-hidden />}
          summary="Matrice d'accord (annotateurs et juges)"
        >
          <AgreementMatrix
            actors={(results.actors as string[]) ?? []}
            kinds={(results.kinds as Record<string, string>) ?? {}}
            matrix={matrix}
          />
        </Disclosure>
      )}

      {errorSamples && errorSamples.length > 0 && (
        <Disclosure
          testId={`paper-drill-errors-${experiment.id}`}
          icon={<TriangleAlert size={13} aria-hidden />}
          summary={`Erreurs représentatives (${errorSamples.length} plus faibles confiances)`}
        >
          <ErrorSamples rows={errorSamples} />
        </Disclosure>
      )}

      <Disclosure
        testId={`paper-gates-detail-${experiment.id}`}
        icon={<ShieldCheck size={13} aria-hidden />}
        summary={`Contrôles de validité (${experiment.gates.filter((g) => g.passed).length}/${experiment.gates.length})`}
        defaultOpen
      >
        <ul className="flex flex-col gap-1">
          {experiment.gates.map((gate) => (
            <li key={gate.id} className="text-[12px]">
              <span className={gate.passed ? "text-success" : gate.blocking ? "text-danger" : "text-warning"}>
                {gate.passed ? "✓" : "✗"}
              </span>{" "}
              <strong className="text-ink">{gate.label}</strong>
              {!gate.blocking && <span className="text-ink-muted"> (non bloquante)</span>} —{" "}
              <span className="text-ink-muted">{gate.detail}</span>
            </li>
          ))}
        </ul>
      </Disclosure>

      {/* PROVENANCE — la condition pour qu'un chiffre reste remontable des mois plus tard. */}
      <Disclosure
        testId={`paper-provenance-${experiment.id}`}
        summary="Provenance complète"
      >
        <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-[12px]">
          {[
            ["Dataset", `${experiment.data.datasetFingerprint?.slice(0, 24)}…`],
            ["Taxonomie", experiment.data.taxonomy ?? "—"],
            ["Source d'étiquettes", experiment.data.labelSource ?? "—"],
            ["Populations", (experiment.data.populations ?? []).join(", ") || "—"],
            ["Spécification de taxonomie", `v${experiment.provenance.taxonomySpecVersion} · ${experiment.provenance.taxonomySpecFingerprint}`],
            ["Version du code", `${experiment.provenance.codeVersion.slice(0, 12)}${experiment.provenance.codeClean ? "" : " (dépôt modifié)"}`],
            ["Exécuté le", experiment.provenance.executedAt],
            ["Environnement", `Python ${experiment.provenance.python} · ${experiment.provenance.platform}`],
            ["Configuration", JSON.stringify(experiment.config)],
            ["Dépend de", experiment.dependsOn.join(", ") || "—"],
          ].map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="break-all font-mono text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Disclosure>

      <Disclosure testId={`paper-latex-${experiment.id}`} summary="Tableau LaTeX de cette expérience">
        <pre className="max-h-64 overflow-auto rounded-md bg-panel-muted/50 p-2 text-[11px] text-ink">
          {experimentToLatex(experiment)}
        </pre>
      </Disclosure>
    </div>
  );
}
