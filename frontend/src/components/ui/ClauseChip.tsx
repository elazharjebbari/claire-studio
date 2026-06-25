"use client";

/**
 * ClauseChip — pastille colorée représentant le thème d'une clause (plan/TOC,
 * inspecteur, diff). Couleur issue des design tokens. Accessible : libellé textuel
 * + couleur (jamais la couleur seule).
 */

import { cn } from "@/lib/cn";
import { getThemeToken, hexToRgbChannels } from "@/lib/tokens";
import { getThemeIcon } from "@/lib/themeIcons";
import type { TriageLevel } from "@/types/contract";
import { ProvenanceMark } from "@/components/ui/ProvenanceMark";

export interface ClauseChipProps {
  themeCode: string;
  /** Affiche l'index d'ancre devant le libellé. */
  anchorIndex?: number;
  selected?: boolean;
  ghost?: boolean;
  /** Validation humaine (point d) : marque de provenance (⚡/★/✎ si validé, ◷ sinon). */
  validated?: boolean;
  /** Provenance — dérivation des 3 types de validation (voir lib/validationDisplay). */
  seededFrom?: string | null;
  resolvedFrom?: string | null;
  triageLevel?: TriageLevel | null;
  /** Nb de thèmes secondaires (multi-label) → badge « +N ». */
  secondaryCount?: number;
  size?: "sm" | "md";
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  className?: string;
}

export function ClauseChip({
  themeCode,
  anchorIndex,
  selected = false,
  ghost = false,
  validated,
  seededFrom,
  resolvedFrom,
  triageLevel,
  secondaryCount = 0,
  size = "md",
  onClick,
  onContextMenu,
  className,
}: ClauseChipProps) {
  const token = getThemeToken(themeCode);
  const rgb = hexToRgbChannels(token.color);
  const ThemeIcon = getThemeIcon(themeCode);
  const Comp = onClick ? "button" : "span";
  // État « brouillon / à valider » (≠ validé) : rendu visuellement distinct et NON ambigu —
  // bordure pointillée + fond plus pâle + libellé atténué, vs validé = plein + accent émeraude.
  const pending = validated === false;

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      onContextMenu={onContextMenu}
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
        ghost || pending ? "border-dashed" : "border-solid",
        selected ? "ring-2 ring-offset-1 ring-offset-panel" : "",
        onClick ? "cursor-pointer hover:brightness-110" : "",
        className,
      )}
      style={
        {
          // La couleur de thème est réservée aux éléments non textuels (fond léger,
          // bordure, pastille) ; le texte reste en `text-ink` pour garantir AA 4.5:1.
          // hexToRgbChannels renvoie des canaux ESPACÉS → syntaxe moderne rgb(R G B / A).
          // Validé = fond plus dense + bordure plus marquée ; à valider = plus pâle (brouillon).
          backgroundColor: `rgb(${rgb} / ${ghost ? 0.08 : pending ? 0.1 : 0.2})`,
          borderColor: `rgb(${rgb} / ${selected ? 0.9 : pending ? 0.35 : 0.55})`,
          "--tw-ring-color": token.color,
          // Accent « validé » à gauche (signal fort, position + couleur, AA) ; absent à
          // l'état brouillon → distinction nette même sans lire le glyphe. Tokenisé (succès).
          boxShadow: validated ? "inset 3px 0 0 rgb(var(--sem-success))" : undefined,
        } as React.CSSProperties
      }
    >
      {/* Glyphe de thème (forme + couleur) à la place du point coloré : désambiguïse les
          teintes proches sans ajouter de signal, dans la couleur du thème (subtil, AA via
          forme). aria-hidden : le sens est déjà porté par le libellé textuel. */}
      <ThemeIcon
        size={size === "sm" ? 12 : 13}
        aria-hidden
        className="shrink-0"
        style={{ color: token.color, opacity: pending ? 0.6 : 1 }}
      />
      {validated !== undefined && (
        <ProvenanceMark clause={{ validated, seededFrom, resolvedFrom, triageLevel }} className="shrink-0" />
      )}
      {anchorIndex !== undefined && (
        <span className="font-mono text-ink">[{anchorIndex}]</span>
      )}
      <span className={cn("min-w-0 truncate", pending ? "text-ink-muted" : "text-ink")}>{token.label}</span>
      {secondaryCount > 0 && (
        <span
          data-testid="multilabel-badge"
          title={`Multi-label : ${secondaryCount} thème(s) secondaire(s)`}
          aria-label={`${secondaryCount} thème(s) secondaire(s)`}
          className="ml-1 shrink-0 rounded-full border border-info/40 px-1 text-[9px] font-bold leading-none text-info"
        >
          +{secondaryCount}
        </span>
      )}
    </Comp>
  );
}
