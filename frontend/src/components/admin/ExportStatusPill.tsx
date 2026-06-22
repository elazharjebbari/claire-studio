"use client";

/** Puce de statut d'un job d'export (tâche de fond), animée par état. a11y: live. */

import { Loader2, Clock, CheckCircle2, XCircle } from "lucide-react";
import type { ExportJob } from "@/types/contract";

const MAP: Record<
  ExportJob["status"],
  { label: string; cls: string; icon: typeof Clock; spin?: boolean; pulse?: boolean }
> = {
  pending: { label: "En file", cls: "border-amber-400/50 bg-amber-400/10 text-amber-300", icon: Clock, pulse: true },
  running: { label: "Export en cours…", cls: "border-accent/50 bg-accent/10 text-accent", icon: Loader2, spin: true },
  done: { label: "Prêt", cls: "border-emerald-400/60 bg-emerald-400/10 text-emerald-300", icon: CheckCircle2 },
  failed: { label: "Échec", cls: "border-danger/50 bg-danger/10 text-danger", icon: XCircle },
};

export function ExportStatusPill({ status }: { status: ExportJob["status"] }) {
  const v = MAP[status];
  const Icon = v.icon;
  return (
    <span
      role="status"
      aria-live="polite"
      data-testid={`export-status-${status}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${v.cls}`}
    >
      <Icon
        size={12}
        aria-hidden
        className={(v.spin ? "animate-spin " : "") + (v.pulse ? "motion-safe:animate-pulse" : "")}
      />
      {v.label}
    </span>
  );
}
