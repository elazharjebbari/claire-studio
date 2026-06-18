"use client";

/**
 * ThemePalette — sélecteur de thème de clause (vocab fermé, F1). Palette colorée
 * filtrable au clavier (recherche typée). Navigation clavier complète + ARIA listbox.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { THEMES, getThemeToken } from "@/lib/tokens";

export interface ThemePaletteProps {
  value: string | null;
  onChange: (themeCode: string) => void;
  /** Restreint la liste aux thèmes d'un scheme donné (sinon tous les tokens). */
  themeCodes?: string[];
  autoFocus?: boolean;
  /**
   * Ref impérative : `.current` est câblé sur une fonction qui focalise le champ
   * de recherche. Permet à un parent (touche `B`, ouverture inspecteur) de donner
   * le focus à la palette sans la remonter.
   */
  focusRef?: React.MutableRefObject<(() => void) | null>;
}

export function ThemePalette({ value, onChange, themeCodes, autoFocus, focusRef }: ThemePaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

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
    <div className="flex flex-col gap-2" data-testid="theme-palette">
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
        className="w-full rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm text-ink placeholder:text-ink-muted"
      />
      <ul
        role="listbox"
        aria-label="Thèmes de clause"
        className="max-h-64 overflow-auto rounded-md border border-line"
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
              onMouseEnter={() => setActiveIdx(i)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors",
                i === activeIdx ? "bg-panel-muted" : "hover:bg-panel-muted/60",
                selected ? "font-semibold" : "",
              )}
            >
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-black/20"
                style={{ backgroundColor: t.color }}
              />
              <span className="flex-1 truncate text-ink">{t.label}</span>
              <span className="font-mono text-[10px] text-ink-muted">{t.code}</span>
              {selected && <span aria-hidden>✓</span>}
            </li>
          );
        })}
        {options.length === 0 && (
          <li className="px-2 py-3 text-sm text-ink-muted">Aucun thème</li>
        )}
      </ul>
    </div>
  );
}
