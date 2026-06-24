"use client";

/**
 * PrefSwitch — interrupteur de préférence persistante (role="switch", track + thumb).
 * Tokens stricts (zéro hex), `aria-checked`, focus visible, activable Espace/Entrée, flash de
 * confirmation borné respectant `prefers-reduced-motion`. Réutilisé par le popover de
 * préférences ET le switch d'auto-pré-annotation.
 */

import { cn } from "@/lib/cn";

export function PrefSwitch({
  checked,
  onChange,
  label,
  disabled = false,
  "data-testid": testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Libellé accessible (aria-label) — le texte visible est géré par l'appelant. */
  label: string;
  disabled?: boolean;
  "data-testid"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-testid={testId}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        disabled && "cursor-not-allowed opacity-50",
        checked
          ? "border-accent/40 bg-accent/80"
          : "border-line bg-panel-muted/60 hover:bg-panel-muted",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-4 w-4 rounded-full transition-transform duration-150 ease-out motion-reduce:transition-none",
          checked ? "translate-x-4 bg-accent-fg ring-1 ring-accent/40" : "translate-x-0.5 bg-ink-muted",
        )}
      />
    </button>
  );
}
