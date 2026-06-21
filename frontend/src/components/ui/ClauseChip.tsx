"use client";

/**
 * ClauseChip — pastille colorée représentant le thème d'une clause (plan/TOC,
 * inspecteur, diff). Couleur issue des design tokens. Accessible : libellé textuel
 * + couleur (jamais la couleur seule).
 */

import { cn } from "@/lib/cn";
import { getThemeToken, hexToRgbChannels } from "@/lib/tokens";

export interface ClauseChipProps {
  themeCode: string;
  /** Affiche l'index d'ancre devant le libellé. */
  anchorIndex?: number;
  selected?: boolean;
  ghost?: boolean;
  /** Validation humaine (point d) : ✓ vert si validée, ◷ ambre sinon (plan des clauses). */
  validated?: boolean;
  size?: "sm" | "md";
  onClick?: () => void;
  className?: string;
}

export function ClauseChip({
  themeCode,
  anchorIndex,
  selected = false,
  ghost = false,
  validated,
  size = "md",
  onClick,
  className,
}: ClauseChipProps) {
  const token = getThemeToken(themeCode);
  const rgb = hexToRgbChannels(token.color);
  const Comp = onClick ? "button" : "span";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      data-testid="clause-chip"
      data-theme={themeCode}
      data-selected={selected || undefined}
      data-ghost={ghost || undefined}
      data-validated={validated || undefined}
      aria-pressed={onClick ? selected : undefined}
      title={validated === false ? `${token.label} — à valider` : token.label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium text-ink transition-colors",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        ghost ? "border-dashed" : "border-solid",
        selected ? "ring-2 ring-offset-1 ring-offset-panel" : "",
        onClick ? "cursor-pointer hover:brightness-110" : "",
        className,
      )}
      style={
        {
          // La couleur de thème est réservée aux éléments non textuels (fond léger,
          // bordure, pastille) ; le texte reste en `text-ink` pour garantir AA 4.5:1.
          backgroundColor: `rgba(${rgb}, ${ghost ? 0.08 : 0.18})`,
          borderColor: `rgba(${rgb}, ${selected ? 0.9 : 0.45})`,
          "--tw-ring-color": token.color,
        } as React.CSSProperties
      }
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: token.color }}
      />
      {validated !== undefined && (
        <span
          aria-hidden
          className={cn(
            "shrink-0 text-[10px] font-bold leading-none",
            validated ? "text-emerald-400" : "text-amber-400",
          )}
        >
          {validated ? "✓" : "◷"}
        </span>
      )}
      {anchorIndex !== undefined && (
        <span className="font-mono text-ink">[{anchorIndex}]</span>
      )}
      <span className="truncate text-ink">{token.label}</span>
    </Comp>
  );
}
