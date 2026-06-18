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
  size?: "sm" | "md";
  onClick?: () => void;
  className?: string;
}

export function ClauseChip({
  themeCode,
  anchorIndex,
  selected = false,
  ghost = false,
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
      aria-pressed={onClick ? selected : undefined}
      title={token.label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        ghost ? "border-dashed opacity-70" : "border-solid",
        selected ? "ring-2 ring-offset-1 ring-offset-panel" : "",
        onClick ? "cursor-pointer hover:brightness-110" : "",
        className,
      )}
      style={
        {
          backgroundColor: `rgba(${rgb}, ${ghost ? 0.08 : 0.18})`,
          borderColor: `rgba(${rgb}, ${selected ? 0.9 : 0.45})`,
          color: token.color,
          "--tw-ring-color": token.color,
        } as React.CSSProperties
      }
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: token.color }}
      />
      {anchorIndex !== undefined && (
        <span className="font-mono opacity-80">[{anchorIndex}]</span>
      )}
      <span className="truncate">{token.label}</span>
    </Comp>
  );
}
