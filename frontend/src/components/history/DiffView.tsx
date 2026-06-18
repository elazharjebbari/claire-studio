"use client";

/**
 * DiffView (F3) — vue diff réelle entre deux versions d'annotation. Affiche, par
 * ancre (`anchor_index`), les clauses ajoutées / supprimées / modifiées / inchangées,
 * avec leur thème coloré (tokens vocabulaire). Pour les clauses modifiées, détaille
 * les champs qui ont changé (avant → après).
 *
 * Composant pur : reçoit un `VersionDiff` (déjà calculé côté API / lib/versionDiff).
 */

import type { ClauseDiff, DiffStatus, PivotClause, VersionDiff } from "@/types/contract";
import { ClauseChip } from "@/components/ui/ClauseChip";
import { getThemeToken } from "@/lib/tokens";
import { cn } from "@/lib/cn";

const STATUS_META: Record<
  DiffStatus,
  { label: string; symbol: string; rowClass: string; badgeClass: string }
> = {
  added: {
    label: "Ajoutée",
    symbol: "+",
    rowClass: "border-l-2 border-emerald-500/60 bg-emerald-500/5",
    badgeClass: "border-emerald-500/50 text-emerald-400",
  },
  removed: {
    label: "Supprimée",
    symbol: "−",
    rowClass: "border-l-2 border-red-500/60 bg-red-500/5",
    badgeClass: "border-red-500/50 text-red-400",
  },
  modified: {
    label: "Modifiée",
    symbol: "~",
    rowClass: "border-l-2 border-amber-500/60 bg-amber-500/5",
    badgeClass: "border-amber-500/50 text-amber-400",
  },
  unchanged: {
    label: "Inchangée",
    symbol: "=",
    rowClass: "border-l-2 border-transparent",
    badgeClass: "border-line text-ink-muted",
  },
};

const FIELD_LABELS: Record<string, string> = {
  theme: "Thème",
  legal_nature: "Nature juridique",
  evidence_span: "Evidence span",
  rationale: "Rationale",
  certainty: "Certitude",
};

function fieldValue(clause: PivotClause | null | undefined, field: string): string {
  if (!clause) return "—";
  if (field === "theme") return getThemeToken(clause.theme).label;
  const raw = (clause as unknown as Record<string, unknown>)[field];
  if (raw === null || raw === undefined || raw === "") return "—";
  return String(raw);
}

function DiffRow({ diff }: { diff: ClauseDiff }) {
  const meta = STATUS_META[diff.status];
  const clause = diff.after ?? diff.before;

  return (
    <li
      data-testid={`diff-row-${diff.anchorIndex}`}
      data-diff-status={diff.status}
      className={cn("flex flex-col gap-1 rounded-md px-3 py-2", meta.rowClass)}
    >
      <div className="flex items-center gap-2 text-sm">
        <span
          aria-hidden
          className="w-4 text-center font-mono font-bold text-ink-muted"
          title={meta.label}
        >
          {meta.symbol}
        </span>
        <span className="font-mono text-[11px] text-ink-muted">[{diff.anchorIndex}]</span>
        {clause && <ClauseChip themeCode={clause.theme} size="sm" ghost={diff.status === "removed"} />}
        <span
          className={cn(
            "ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase",
            meta.badgeClass,
          )}
        >
          {meta.label}
        </span>
      </div>

      {diff.status === "modified" && diff.changedFields && diff.changedFields.length > 0 && (
        <ul className="ml-6 flex flex-col gap-0.5 text-xs" data-testid="diff-changed-fields">
          {diff.changedFields.map((field) => (
            <li key={field} className="flex flex-wrap items-baseline gap-1.5 text-ink-muted">
              <span className="font-medium text-ink">{FIELD_LABELS[field] ?? field}</span>
              <span className="text-red-400 line-through">{fieldValue(diff.before, field)}</span>
              <span aria-hidden>→</span>
              <span className="text-emerald-400">{fieldValue(diff.after, field)}</span>
            </li>
          ))}
        </ul>
      )}

      {(diff.status === "added" || diff.status === "removed") &&
        clause?.evidence_span && (
          <p className="ml-6 truncate text-xs italic text-ink-muted">
            « {clause.evidence_span} »
          </p>
        )}
    </li>
  );
}

export function DiffView({
  diff,
  showUnchanged = false,
}: {
  diff: VersionDiff;
  showUnchanged?: boolean;
}) {
  const rows = diff.clauses.filter((c) => showUnchanged || c.status !== "unchanged");

  return (
    <section data-testid="diff-view" aria-label="Différences entre versions">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <span>
          v{diff.from.number}
          {diff.from.label ? ` · ${diff.from.label}` : ""}
        </span>
        <span aria-hidden>→</span>
        <span className="font-medium text-ink">
          v{diff.to.number}
          {diff.to.label ? ` · ${diff.to.label}` : ""}
        </span>
        <span className="ml-auto flex items-center gap-2" data-testid="diff-summary">
          <span className="text-emerald-400">+{diff.summary.added}</span>
          <span className="text-red-400">−{diff.summary.removed}</span>
          <span className="text-amber-400">~{diff.summary.modified}</span>
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted" data-testid="diff-empty">
          Aucune différence entre ces deux versions.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((d) => (
            <DiffRow key={d.anchorIndex} diff={d} />
          ))}
        </ul>
      )}
    </section>
  );
}
