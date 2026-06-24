"use client";

/**
 * Stats de concordance GOLD — classement « qui est le plus proche du gold » (annotateurs
 * ↔ gold), concordance LLM ↔ gold, et κ inter-annotateurs (A↔A). Barres tokenisées.
 */

import { useEffect } from "react";
import Link from "next/link";
import { Trophy, Bot, Gauge, ChevronLeft } from "lucide-react";
import { useGoldStats } from "@/lib/api/hooks";
import { useUiStore } from "@/store/ui";
import { Panel } from "@/components/ui/primitives";
import { readableTextColor } from "@/lib/tokens";
import type { GoldStatRow } from "@/lib/gold/types";

function Bar({ pct }: { pct: number | null }) {
  const v = pct ?? 0;
  const tone = v >= 80 ? "bg-success" : v >= 60 ? "bg-warning" : "bg-danger";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-muted" aria-hidden>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
    </div>
  );
}

function AnnotatorRow({ row, rank }: { row: GoldStatRow; rank: number }) {
  return (
    <li className="flex items-center gap-3 py-1.5" data-testid={`gold-stat-${row.username}`}>
      <span className="w-5 shrink-0 text-center font-mono text-[11px] text-ink-muted">{rank}</span>
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
        style={{ backgroundColor: row.color, color: readableTextColor(row.color) }}
        aria-hidden
      >
        {row.displayName.slice(0, 1).toUpperCase()}
      </span>
      <span className="w-28 shrink-0 truncate text-sm text-ink">{row.displayName}</span>
      <Bar pct={row.pct} />
      <span className="w-20 shrink-0 text-right font-mono text-[12px] text-ink">
        {row.pct == null ? "—" : `${row.pct}%`}
        <span className="ml-1 text-[10px] text-ink-muted">n={row.n}</span>
      </span>
    </li>
  );
}

export function GoldStatsPanel({ slug }: { slug: string }) {
  const setProject = useUiStore((s) => s.setCurrentProject);
  useEffect(() => setProject(slug), [slug, setProject]);
  const { data, isLoading } = useGoldStats(slug);

  if (isLoading) return <div className="px-6 py-8 text-ink-muted">Chargement des stats…</div>;
  const stats = data;
  const meanKappa = stats?.iaa?.meanKappa ?? null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8" data-testid="gold-stats">
      <Link
        href={`/projects/${slug}/gold`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft size={15} aria-hidden /> Cockpit
      </Link>
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-ink">
        <Trophy size={18} className="text-gold" aria-hidden /> Concordance avec le gold
      </h1>
      <p className="mb-5 text-sm text-ink-muted">
        Qui se rapproche le plus du gold décidé, et comment les modèles s'y comparent.
      </p>

      {stats?.closestToGold && (
        <Panel className="mb-5 flex items-center gap-3 border-gold/40 bg-gold/5 p-3" data-testid="gold-closest">
          <Trophy size={20} className="text-gold" aria-hidden />
          <div>
            <div className="text-sm font-semibold text-ink">{stats.closestToGold.displayName}</div>
            <div className="text-[12px] text-ink-muted">
              le plus proche du gold — {stats.closestToGold.pct}% d'accord
            </div>
          </div>
        </Panel>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Documents comparés" value={String(stats?.documentsCompared ?? 0)} />
        <Kpi label="Phrases gold" value={String(stats?.goldCovered ?? 0)} />
        <Kpi label="κ inter-annot." value={meanKappa == null ? "—" : meanKappa.toFixed(2)} icon={<Gauge size={14} />} />
      </div>

      <h2 className="mb-1 mt-6 text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Annotateurs ↔ gold
      </h2>
      <Panel className="p-3">
        <ul className="divide-y divide-line">
          {(stats?.annotators ?? []).length === 0 ? (
            <li className="py-3 text-center text-sm text-ink-muted">Aucun gold décidé pour l'instant.</li>
          ) : (
            (stats?.annotators ?? []).map((row, i) => <AnnotatorRow key={row.username} row={row} rank={i + 1} />)
          )}
        </ul>
      </Panel>

      <h2 className="mb-1 mt-6 flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-ink-muted">
        <Bot size={14} aria-hidden /> Modèles ↔ gold
      </h2>
      <Panel className="p-3">
        <ul className="flex flex-wrap gap-2" data-testid="gold-judges">
          {(stats?.judges ?? []).map((j) => (
            <li
              key={j.judge}
              className="inline-flex items-center gap-2 rounded-full border border-info/40 bg-info/10 px-3 py-1 text-[12px] text-info"
            >
              <span className="font-medium">{j.judge}</span>
              <span className="font-mono">{j.pct == null ? "—" : `${j.pct}%`}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <Panel className="p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-2xl font-semibold text-ink">
        {icon}
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</div>
    </Panel>
  );
}
