"use client";

/**
 * DocStatusBadge (point 2) — pastille de statut d'un document pour MA session, sur les
 * pages projet (tableau de bord & documents). Reflète l'état réel : brouillon / soumis /
 * en revue / approuvé / rejeté / non commencé, ET le VERROU (soumission auto ou verrou
 * manuel) via une icône de cadenas. Couleurs par tokens sémantiques (zéro hex en dur).
 */

import {
  CheckCircle2,
  Pencil,
  FileText,
  Eye,
  XCircle,
  Archive,
  Lock,
  type LucideIcon,
} from "lucide-react";
import type { AnnotationStatus } from "@/types/contract";

type RollupStatus = AnnotationStatus | "unstarted";

const META: Record<RollupStatus, { label: string; cls: string; Icon: LucideIcon }> = {
  unstarted: {
    label: "Non commencé",
    cls: "border-line bg-panel-muted/60 text-ink-muted",
    Icon: FileText,
  },
  draft: {
    label: "Brouillon",
    cls: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    Icon: Pencil,
  },
  submitted: {
    label: "Soumis",
    cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    Icon: CheckCircle2,
  },
  in_review: {
    label: "En revue",
    cls: "border-sky-400/40 bg-sky-400/10 text-sky-300",
    Icon: Eye,
  },
  approved: {
    label: "Approuvé",
    cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    Icon: CheckCircle2,
  },
  rejected: {
    label: "Rejeté",
    cls: "border-red-400/40 bg-red-400/10 text-red-300",
    Icon: XCircle,
  },
  archived: {
    label: "Archivé",
    cls: "border-line bg-panel-muted/60 text-ink-muted",
    Icon: Archive,
  },
};

export function DocStatusBadge({
  status,
  locked = false,
}: {
  status: RollupStatus;
  locked?: boolean;
}) {
  const m = META[status] ?? META.unstarted;
  const { Icon } = m;
  return (
    <span
      data-testid="doc-status-badge"
      data-status={status}
      data-locked={locked ? "true" : "false"}
      title={
        locked
          ? `${m.label} · verrouillé (édition gelée)`
          : m.label
      }
      className={
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
        m.cls
      }
    >
      <Icon size={12} aria-hidden />
      {m.label}
      {locked && (
        <>
          <span aria-hidden className="opacity-50">·</span>
          <Lock size={11} aria-hidden data-testid="doc-status-lock" />
        </>
      )}
    </span>
  );
}
