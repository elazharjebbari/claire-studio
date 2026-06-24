"use client";

/**
 * ThemePalette — sélecteur de thème de clause (vocab fermé, F1). Palette colorée
 * filtrable au clavier (recherche typée). Navigation clavier complète + ARIA listbox.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { THEMES, getThemeToken } from "@/lib/tokens";
import { getThemeDescription } from "@/lib/themeDescriptions";

export interface ThemePaletteProps {
  value: string | null;
  onChange: (themeCode: string) => void;
  /** Restreint la liste aux thèmes d'un scheme donné (sinon tous les tokens). */
  themeCodes?: string[];
  autoFocus?: boolean;
  /**
   * Disposition : `list` (par défaut, défilable) ou `grid` (2 colonnes, SANS scroll —
   * toutes les catégories visibles d'un coup, pour le menu clic-droit, D4).
   */
  layout?: "list" | "grid";
  /** Info-bulle (libellé + description) au survol PROLONGÉ (intention), pour le menu. */
  describeOnHover?: boolean;
  /**
   * `fill` (layout liste) : la palette occupe toute la hauteur disponible —
   * racine en colonne flex extensible (`flex-1`) et liste défilante (`flex-1`) au
   * lieu d'un `max-h-64` fixe. Évite la bande vide quand la palette est seule dans
   * le panneau (état « aucune clause »). Sans effet en `grid`.
   */
  fill?: boolean;
  /**
   * Ref impérative : `.current` est câblé sur une fonction qui focalise le champ
   * de recherche. Permet à un parent (touche `B`, ouverture inspecteur) de donner
   * le focus à la palette sans la remonter.
   */
  focusRef?: React.MutableRefObject<(() => void) | null>;
}

export function ThemePalette({
  value,
  onChange,
  themeCodes,
  autoFocus,
  layout = "list",
  describeOnHover = false,
  fill = false,
  focusRef,
}: ThemePaletteProps) {
  const grid = layout === "grid";
  // `fill` ne concerne que la liste (la grille est déjà sans scroll, D4).
  const fillList = fill && !grid;
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Info-bulle au survol PROLONGÉ (~450 ms : on soupçonne une intention, pas un simple
  // passage) → libellé complet + courte description (doc annotateur).
  const [hovered, setHovered] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function armTooltip(code: string) {
    if (!describeOnHover) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(code), 450);
  }
  function disarmTooltip() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }
  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  useEffect(() => {
    if (!focusRef) return;
    focusRef.current = () => inputRef.current?.focus();
    return () => {
      focusRef.current = null;
    };
  }, [focusRef]);

  const options = useMemo(() => {
    const base = themeCodes
      ? themeCodes.map(getThemeToken)
      : THEMES;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (t) => t.code.toLowerCase().includes(q) || t.label.toLowerCase().includes(q),
    );
  }, [query, themeCodes]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[activeIdx];
      if (opt) onChange(opt.code);
    }
  }

  return (
    <div
      className={cn("flex flex-col gap-2", fillList && "min-h-0 flex-1")}
      data-testid="theme-palette"
    >
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIdx(0);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Filtrer un thème…"
        aria-label="Rechercher un thème"
        className="w-full shrink-0 rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm text-ink placeholder:text-ink-muted"
      />
      <ul
        role="listbox"
        aria-label="Thèmes de clause"
        className={cn(
          "rounded-md border border-line",
          // grid : 2 colonnes, AUCUN scroll (toutes les catégories visibles, D4).
          grid
            ? "grid grid-cols-2 gap-0.5 p-0.5"
            : // liste : `fill` → occupe la hauteur restante ; sinon plafond fixe.
              fillList
              ? "min-h-0 flex-1 overflow-auto"
              : "max-h-64 overflow-auto",
        )}
      >
        {options.map((t, i) => {
          const selected = value === t.code;
          return (
            <li
              key={t.code}
              role="option"
              aria-selected={selected}
              data-testid={`theme-option-${t.code}`}
              tabIndex={0}
              onClick={() => onChange(t.code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(t.code);
                }
              }}
              onMouseEnter={() => {
                setActiveIdx(i);
                armTooltip(t.code);
              }}
              onMouseLeave={disarmTooltip}
              aria-describedby={describeOnHover ? "theme-tooltip" : undefined}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors",
                grid ? "rounded" : "",
                i === activeIdx ? "bg-panel-muted" : "hover:bg-panel-muted/60",
                selected ? "font-semibold" : "",
              )}
            >
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-black/20"
                style={{ backgroundColor: t.color }}
              />
              {/* Grille : libellé COMPLET (retour à la ligne) ; liste : tronqué (le code
                  occupe la droite). Évite les « … » illisibles dans la grille 2 colonnes. */}
              <span className={cn("min-w-0 flex-1 text-ink", grid ? "leading-snug" : "truncate")}>
                {t.label}
              </span>
              {/* Code masqué en grille (gain de place pour 2 colonnes sans scroll, D4). */}
              {!grid && <span className="font-mono text-[10px] text-ink-muted">{t.code}</span>}
              {selected && <span aria-hidden>✓</span>}
            </li>
          );
        })}
        {options.length === 0 && (
          <li className="px-2 py-3 text-sm text-ink-muted">Aucun thème</li>
        )}
      </ul>
      {/* Info-bulle d'intention : libellé complet + courte description (doc annotateur). */}
      {describeOnHover && hovered && (
        <div
          id="theme-tooltip"
          role="tooltip"
          data-testid="theme-tooltip"
          className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-xs"
        >
          <div className="flex items-center gap-1.5 font-semibold text-ink">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: getThemeToken(hovered).color }}
            />
            {getThemeToken(hovered).label}
          </div>
          {getThemeDescription(hovered) && (
            <p className="mt-0.5 text-ink-muted">{getThemeDescription(hovered)}</p>
          )}
        </div>
      )}
    </div>
  );
}
