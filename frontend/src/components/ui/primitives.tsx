"use client";

/** Petites primitives réutilisables (boutons, badges, panneaux, champs). */

import type { ReactNode } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "ghost" | "outline" | "subtle" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";
/** Machine d'états : repos → en cours (spinner, bloqué) → succès (✓) / erreur (⚠, re-cliquable). */
type ButtonState = "idle" | "pending" | "success" | "error";

const VARIANT_CLS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:brightness-110",
  outline: "border border-line bg-panel text-ink hover:bg-panel-muted",
  ghost: "text-ink-muted hover:bg-panel-muted hover:text-ink",
  subtle: "bg-panel-muted text-ink hover:brightness-110",
  // Actions critiques/de confirmation. `text-bg` s'inverse avec le thème en même temps que
  // le token danger/success → contraste AA garanti en clair ET sombre (pas d'hex en dur).
  danger: "bg-danger text-bg hover:brightness-110",
  success: "bg-success text-bg hover:brightness-110",
};

const SIZE_CLS: Record<ButtonSize, string> = {
  sm: "px-2 py-1 text-xs gap-1.5",
  md: "px-3 py-1.5 text-sm gap-2",
  lg: "px-4 py-2 text-base gap-2",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** État explicite (piloté par l'appelant, ex. mutation react-query). */
  state?: ButtonState;
  /** Raccourci pour state="pending". */
  loading?: boolean;
  /** Icône de tête (slot), remplacée par le voyant d'état le cas échéant. */
  icon?: ReactNode;
}

export function Button({
  variant = "outline",
  size = "md",
  state,
  loading,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const eff: ButtonState = loading ? "pending" : state ?? "idle";
  const pending = eff === "pending";
  // En cours = non cliquable (anti double-clic) ; erreur = reste cliquable (réessayer) ;
  // succès = non bloquant (voyant transitoire piloté par l'appelant).
  const isDisabled = disabled || pending;

  const lead =
    eff === "pending" ? <Loader2 size={14} className="animate-spin" aria-hidden /> :
    eff === "success" ? <CheckCircle2 size={14} aria-hidden /> :
    eff === "error" ? <AlertCircle size={14} aria-hidden /> :
    icon ?? null;

  return (
    <button
      {...props}
      disabled={isDisabled}
      aria-busy={pending || undefined}
      data-state={eff}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        SIZE_CLS[size],
        VARIANT_CLS[variant],
        eff === "error" && "ring-1 ring-danger/60",
        className,
      )}
    >
      {lead}
      {children}
      {/* Annonce d'échec aux lecteurs d'écran (le visuel seul ne suffit pas). */}
      {eff === "error" && <span role="alert" className="sr-only">Échec — réessayez</span>}
    </button>
  );
}

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center rounded-full border border-line bg-panel-muted px-2 py-0.5 text-[11px] font-medium text-ink-muted",
        className,
      )}
    />
  );
}

export function Panel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn("rounded-lg border border-line bg-panel", className)}
    />
  );
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

/**
 * Barre de progression accessible — déterminée (`value` 0-100 réel) ou indéterminée
 * (`indeterminate`, remplissage figé animé) pour un état « en cours » dont on ne connaît
 * pas la fraction accomplie (ex. un job Grid'5000 : `progress` reste à 0 tant que le
 * worker n'a pas rapatrié `results.json`, puis saute directement à 100 — afficher une
 * barre à 0% figée pendant potentiellement des heures serait trompeur, l'indéterminée
 * dit honnêtement « ça avance, sans chiffre fiable »).
 */
export function ProgressBar({
  value,
  indeterminate = false,
  label,
  className,
  testId,
  describedBy,
}: {
  value?: number;
  indeterminate?: boolean;
  label: string;
  className?: string;
  testId?: string;
  /** `id` d'un élément qui complète la barre (ex. « depuis 3 min ») — lu à la suite par
   * un lecteur d'écran, plutôt que deux annonces sans lien explicite entre elles. */
  describedBy?: string;
}) {
  return (
    <div
      className={cn("h-1 w-24 overflow-hidden rounded-full bg-panel-muted", className)}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      aria-describedby={describedBy}
      data-indeterminate={indeterminate || undefined}
      data-testid={testId}
    >
      <div
        className={cn(
          "h-full rounded-full bg-accent transition-[width]",
          indeterminate && "w-2/5 motion-safe:animate-pulse",
        )}
        style={indeterminate ? undefined : { width: `${value ?? 0}%` }}
      />
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    draft: "border-ink-muted/40 text-ink-muted",
    submitted: "border-accent/50 text-accent",
    in_review: "border-warning/50 text-warning",
    approved: "border-success/50 text-success",
    rejected: "border-danger/50 text-danger",
    archived: "border-ink-muted/30 text-ink-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone[status] ?? "border-line text-ink-muted",
      )}
    >
      {status}
    </span>
  );
}
