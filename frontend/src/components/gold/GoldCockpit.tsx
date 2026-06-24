"use client";

/**
 * Cockpit GOLD — vue de pilotage : une ligne PAR document avec statut, avancement,
 * verrou d'arbitrage et répartition accord/divergence. Point d'entrée vers l'atelier.
 * Couleurs par tokens sémantiques (zéro hex), encodage statut = pastille + texte + barre.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Gavel, Lock, ShieldCheck, AlertTriangle, BarChart3, Download, Settings2 } from "lucide-react";
import { useGoldDocuments, useProject, useMe } from "@/lib/api/hooks";
import { createExport } from "@/lib/api/endpoints";
import { isAdminRole } from "@/lib/roles";
import { useUiStore } from "@/store/ui";
import { Button, Panel } from "@/components/ui/primitives";
import { summarize } from "@/lib/gold/cockpit";
import { STATUS_META, progressBarClass } from "@/lib/gold/styling";
import type { GoldDocumentRow } from "@/lib/gold/types";

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Panel className="p-3 text-center">
      <div className={`text-2xl font-semibold ${tone ?? "text-ink"}`} data-testid="gold-kpi">
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</div>
    </Panel>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-muted" aria-hidden>
      <div
        className={`h-full rounded-full ${progressBarClass(clamped)}`}
        style={{ width: `${Math.round(clamped * 100)}%` }}
      />
    </div>
  );
}

function CountChip({
  n,
  label,
  cls,
}: {
  n: number | undefined;
  label: string;
  cls: string;
}) {
  if (!n) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {n} {label}
    </span>
  );
}

function DocRow({ slug, row }: { slug: string; row: GoldDocumentRow }) {
  const meta = STATUS_META[row.status];
  const pct = Math.round((row.pctResolved ?? 0) * 100);
  const c = row.counts ?? {};
  return (
    <Link
      href={`/projects/${slug}/gold/${encodeURIComponent(row.document.externalId)}`}
      data-testid={`gold-doc-${row.document.externalId}`}
      data-status={row.status}
      className="flex flex-col gap-1.5 rounded-md px-3 py-2.5 transition-colors hover:bg-panel-muted"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">{row.document.title}</span>
          <span className="shrink-0 text-[11px] text-ink-muted">{row.document.externalId}</span>
          {row.locked && (
            <span
              data-testid={`gold-doc-lock-${row.document.externalId}`}
              title={row.lockedBy ? `Arbitré par ${row.lockedBy}` : "Verrouillé"}
              className="inline-flex shrink-0 items-center gap-0.5 rounded bg-warning/15 px-1 text-[10px] font-semibold text-warning"
            >
              <Lock size={10} aria-hidden /> {row.lockedBy ?? ""}
            </span>
          )}
        </span>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}
          data-testid={`gold-status-${row.document.externalId}`}
        >
          {row.status === "resolved" ? <ShieldCheck size={11} aria-hidden /> : <Gavel size={11} aria-hidden />}
          {meta.label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ProgressBar pct={row.pctResolved ?? 0} />
        <span className="w-16 shrink-0 text-right font-mono text-[11px] text-ink-muted">
          {c.decided ?? 0}/{row.document.nSentences} · {pct}%
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <CountChip n={c.strict} label="strict" cls="border-success/40 bg-success/10 text-success" />
        <CountChip n={c.majority} label="majorité" cls="border-warning/40 bg-warning/10 text-warning" />
        <CountChip n={c.divergence} label="divergence" cls="border-danger/40 bg-danger/10 text-danger" />
        <CountChip n={c.auto} label="auto" cls="border-info/40 bg-info/10 text-info" />
        {!!c.highRisk && (
          <span className="inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger">
            <AlertTriangle size={10} aria-hidden /> {c.highRisk} à risque
          </span>
        )}
      </div>
    </Link>
  );
}

export function GoldCockpit({ slug }: { slug: string }) {
  const setProject = useUiStore((s) => s.setCurrentProject);
  useEffect(() => setProject(slug), [slug, setProject]);

  const { data: project } = useProject(slug);
  const { data: me } = useMe();
  const isAdmin = isAdminRole(me?.role);
  const { data, isLoading, error } = useGoldDocuments(slug);

  const [exported, setExported] = useState(false);
  const exportGold = useMutation({
    mutationFn: () => createExport(slug, { format: "jsonl", scope: { gold: true } }),
    onSuccess: () => setExported(true),
  });

  if (isLoading) {
    return <div className="px-6 py-8 text-ink-muted">Chargement du cockpit GOLD…</div>;
  }
  if (error) {
    return (
      <div className="px-6 py-8 text-danger" data-testid="gold-cockpit-error">
        Impossible de charger la résolution GOLD.
      </div>
    );
  }

  const rows = data?.results ?? [];
  const s = summarize(rows);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8" data-testid="gold-cockpit">
      <div className="mb-1 flex items-center gap-2">
        <Gavel size={18} className="text-gold" aria-hidden />
        <h1 className="text-xl font-semibold text-ink">
          Résolution GOLD{project ? ` — ${project.name}` : ""}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/projects/${slug}/gold/stats`}
            data-testid="gold-stats-link"
            className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-ink hover:bg-panel-muted"
          >
            <BarChart3 size={14} aria-hidden /> Stats
          </Link>
          {(isAdmin || project?.myRole === "lead") && (
            <Link
              href={`/projects/${slug}/gold/config`}
              data-testid="gold-config-link"
              className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-ink hover:bg-panel-muted"
            >
              <Settings2 size={14} aria-hidden /> Configurer
            </Link>
          )}
          {isAdmin && (
            <Button
              variant="subtle"
              data-testid="gold-export"
              disabled={exportGold.isPending}
              onClick={() => exportGold.mutate()}
              title="Exporter le gold décidé (tâche de fond)"
            >
              <Download size={14} aria-hidden /> Exporter le gold
            </Button>
          )}
        </div>
      </div>
      <p className="mb-2 text-sm text-ink-muted">
        Arbitrer les conflits inter-annotateurs pour décider le gold standard, document par document.
      </p>
      {exported && (
        <div
          data-testid="gold-export-started"
          className="mb-4 rounded-md border border-info/40 bg-info/10 px-3 py-1.5 text-[12px] text-info"
        >
          Export lancé en tâche de fond.{" "}
          <Link href="/admin/exports" className="underline">
            Suivre et télécharger dans Exports
          </Link>
          .
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Documents" value={String(s.total)} />
        <Kpi label="Résolus" value={`${s.resolved}/${s.total}`} tone="text-success" />
        <Kpi label="En cours" value={String(s.inProgress)} tone="text-warning" />
        <Kpi label="Avancement" value={`${Math.round(s.pctOverall * 100)}%`} />
        <Kpi label="Phrases à risque" value={String(s.highRisk)} tone={s.highRisk ? "text-danger" : "text-ink"} />
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">Documents</h2>
      <Panel className="divide-y divide-line p-1">
        {rows.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-ink-muted">Aucun document.</div>
        ) : (
          rows.map((row) => <DocRow key={row.document.id} slug={slug} row={row} />)
        )}
      </Panel>
    </div>
  );
}
