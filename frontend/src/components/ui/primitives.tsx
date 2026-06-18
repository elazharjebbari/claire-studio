"use client";

/** Petites primitives réutilisables (boutons, badges, panneaux, champs). */

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "ghost" | "outline" | "subtle";

export function Button({
  variant = "outline",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-accent text-accent-fg hover:brightness-110",
        variant === "outline" && "border border-line bg-panel text-ink hover:bg-panel-muted",
        variant === "ghost" && "text-ink-muted hover:bg-panel-muted hover:text-ink",
        variant === "subtle" && "bg-panel-muted text-ink hover:brightness-110",
        className,
      )}
    />
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

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    draft: "border-ink-muted/40 text-ink-muted",
    submitted: "border-accent/50 text-accent",
    in_review: "border-amber-500/50 text-amber-400",
    approved: "border-emerald-500/50 text-emerald-400",
    rejected: "border-red-500/50 text-red-400",
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
