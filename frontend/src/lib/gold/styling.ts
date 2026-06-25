/**
 * Stylisation PURE du module GOLD — libellés + classes Tailwind sémantiques.
 * ZÉRO hex en dur (charte §A) : tout passe par les tokens (success/warning/danger/info/gold)
 * adossés aux CSS vars. Encodage jamais par couleur seule (charte §B) : label + icône en plus.
 * Réutilisé par le cockpit (V4) et l'atelier (V5).
 */
import type { AgreementClass, AutoLevel, RiskBand } from "@/lib/goldScoring";
import type { GoldStatus } from "./types";

export interface Meta {
  label: string;
  /** classes de pastille (bordure + fond translucide + texte) */
  cls: string;
}

export const STATUS_META: Record<GoldStatus, Meta> = {
  awaiting: {
    label: "En attente d'annotations",
    cls: "border-line bg-panel-muted/60 text-ink-muted",
  },
  ready: { label: "Prête à résoudre", cls: "border-info/40 bg-info/10 text-info" },
  in_progress: { label: "En cours", cls: "border-warning/40 bg-warning/10 text-warning" },
  resolved: { label: "Résolue", cls: "border-success/40 bg-success/10 text-success" },
};

export const AGREEMENT_META: Record<AgreementClass, Meta> = {
  strict: { label: "Accord strict", cls: "border-success/40 bg-success/10 text-success" },
  majority: { label: "Majorité", cls: "border-warning/40 bg-warning/10 text-warning" },
  divergence: { label: "Divergence", cls: "border-danger/40 bg-danger/10 text-danger" },
  empty: { label: "Non couvert", cls: "border-line bg-panel-muted/60 text-ink-muted" },
};

export const RISK_META: Record<RiskBand, Meta> = {
  low: { label: "Faible", cls: "border-success/40 bg-success/10 text-success" },
  medium: { label: "Moyen", cls: "border-warning/40 bg-warning/10 text-warning" },
  high: { label: "Élevé", cls: "border-danger/40 bg-danger/10 text-danger" },
};

export const AUTO_META: Record<AutoLevel, Meta> = {
  auto_1click: { label: "Accord absolu", cls: "border-success/40 bg-success/10 text-success" },
  auto: { label: "Auto (peu risqué)", cls: "border-info/40 bg-info/10 text-info" },
  manual: { label: "À trancher", cls: "border-warning/40 bg-warning/10 text-warning" },
};

/** Classe de barre de progression selon l'avancement (token, pas d'hex). */
export function progressBarClass(pct: number): string {
  if (pct >= 1) return "bg-success";
  if (pct > 0) return "bg-warning";
  return "bg-line";
}
