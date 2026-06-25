"use client";

/**
 * ThemeMultiPicker — grille UNIFIÉE de sélection multi-label (dossier
 * docs/pactiva/dossier-theme-multipicker). Une seule grille pour choisir le thème
 * PRIMAIRE (★ Principal) ET les SECONDAIRES (numérotés 1, 2, …) :
 *  - clic sur une option non choisie → l'ajoute (primaire si aucun, sinon secondaire) ;
 *  - clic sur une option choisie → la retire ;
 *  - bouton ★ sur un secondaire → le promeut primaire (l'ancien primaire redevient 2ⁿ) ;
 *  - un thème REFUGE ne peut être que PRIMAIRE (désactivé en secondaire) ;
 *  - indice LLM DISCRET : micro-initiale des juges ayant proposé ce thème.
 *
 * Présentational/pur : l'état vit dans le store (DraftClause.themes) ; le composant lit
 * `selection` et émet `onToggle`/`onPromote`. Navigation clavier complète.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Star, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { THEMES, getThemeToken } from "@/lib/tokens";
import { getThemeDescription } from "@/lib/themeDescriptions";
import { readableTextColor } from "@/lib/tokens";
import type { ThemeTag } from "@/types/contract";

export interface ThemeMultiPickerProps {
  /** Sélection courante (primaire + secondaires) ; l'ordre du tableau = l'ordre affiché. */
  selection: ThemeTag[];
  themeCodes?: string[];
  /** Codes « primaire uniquement » (refuges) : désactivés en secondaire. */
  refuges?: string[];
  /** Indice LLM discret : code de thème → libellés des juges l'ayant proposé. */
  judgeHints?: Record<string, string[]>;
  describeOnHover?: boolean;
  onToggle: (code: string) => void;
  onPromote: (code: string) => void;
  focusRef?: React.MutableRefObject<(() => void) | null>;
}

export function ThemeMultiPicker({
  selection,
  themeCodes,
  refuges = [],
  judgeHints = {},
  describeOnHover = false,
  onToggle,
  onPromote,
  focusRef,
}: ThemeMultiPickerProps) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refugeSet = useMemo(() => new Set(refuges), [refuges]);

  const primary = selection.find((t) => t.role === "primary") ?? null;
  const secondaries = selection.filter((t) => t.role === "secondary");
  const orderOf = (code: string) => secondaries.findIndex((t) => t.label === code) + 1; // 1-based
  const isSelected = (code: string) => selection.some((t) => t.label === code);

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
    const base = themeCodes ? themeCodes.map(getThemeToken) : THEMES;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (t) => t.code.toLowerCase().includes(q) || t.label.toLowerCase().includes(q),
    );
  }, [query, themeCodes]);

  // Refuge désactivé en secondaire : un primaire DIFFÉRENT existe déjà et ce n'est pas
  // une option déjà sélectionnée (un refuge primaire reste cliquable pour le retirer).
  const isRefugeDisabled = (code: string) =>
    refugeSet.has(code) && !!primary && primary.label !== code && !isSelected(code);

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
      if (opt && !isRefugeDisabled(opt.code)) onToggle(opt.code);
    } else if (e.key.toLowerCase() === "p") {
      // Promouvoir l'option active en primaire (si sélectionnée).
      const opt = options[activeIdx];
      if (opt && isSelected(opt.code)) {
        e.preventDefault();
        onPromote(opt.code);
      }
    }
  }

  const nSecond = secondaries.length;

  return (
    <div className="flex flex-col gap-2" data-testid="theme-multipicker">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-muted" data-testid="multipicker-summary">
          {primary ? (
            <>
              <span className="font-medium text-ink">1 principal</span>
              {nSecond > 0 && ` · ${nSecond} secondaire${nSecond > 1 ? "s" : ""}`}
            </>
          ) : (
            "Choisissez un thème principal"
          )}
        </span>
      </div>
      <input
        ref={inputRef}
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
        aria-multiselectable="true"
        aria-label="Thèmes de clause (principal + secondaires)"
        className="grid grid-cols-2 gap-0.5 rounded-md border border-line p-0.5"
      >
        {options.map((t, i) => {
          const selected = isSelected(t.code);
          const isPrimary = primary?.label === t.code;
          const order = isPrimary ? 0 : orderOf(t.code);
          const disabled = isRefugeDisabled(t.code);
          const hints = judgeHints[t.code] ?? [];
          return (
            <li
              key={t.code}
              role="option"
              aria-selected={selected}
              aria-disabled={disabled || undefined}
              aria-label={
                isPrimary
                  ? `${t.label} — thème principal`
                  : order > 0
                    ? `${t.label} — thème secondaire ${order}`
                    : disabled
                      ? `${t.label} — principal uniquement`
                      : t.label
              }
              data-testid={`theme-option-${t.code}`}
              data-role={isPrimary ? "primary" : order > 0 ? "secondary" : undefined}
              tabIndex={0}
              aria-describedby={describeOnHover ? "theme-tooltip" : undefined}
              onClick={() => {
                if (!disabled) onToggle(t.code);
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !disabled) {
                  e.preventDefault();
                  onToggle(t.code);
                }
              }}
              onMouseEnter={() => {
                setActiveIdx(i);
                armTooltip(t.code);
              }}
              onMouseLeave={disarmTooltip}
              className={cn(
                "flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-[13px] transition-colors",
                disabled
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer",
                isPrimary
                  ? "bg-accent/10 ring-1 ring-inset ring-accent/50 font-semibold"
                  : order > 0
                    ? "bg-panel-muted/60"
                    : i === activeIdx
                      ? "bg-panel-muted"
                      : "hover:bg-panel-muted/60",
              )}
              style={
                order > 0
                  ? { boxShadow: `inset 2px 0 0 ${getThemeToken(t.code).color}` }
                  : undefined
              }
            >
              <span
                aria-hidden
                className="mt-0.5 h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-black/20"
                style={{ backgroundColor: t.color }}
              />
              {/* Colonne texte : libellé COMPLET (retour à la ligne, jamais tronqué) +
                  marqueurs primaire/secondaire EN DESSOUS (le texte garde toute la largeur). */}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-start gap-1">
                  <span className="min-w-0 flex-1 leading-snug text-ink">{t.label}</span>
                  {/* Indice LLM discret : initiale(s) des juges ayant proposé ce thème. */}
                  {hints.length > 0 && (
                    <span
                      data-testid={`llm-hint-${t.code}`}
                      title={`Proposé par ${hints.join(", ")}`}
                      className="mt-0.5 shrink-0 font-mono text-[8px] uppercase text-ink-muted/70"
                    >
                      {hints.map((h) => h[0]).join("")}
                    </span>
                  )}
                </span>

                {isPrimary && (
                  <span
                    data-testid={`primary-badge-${t.code}`}
                    className="inline-flex w-fit items-center gap-0.5 rounded bg-accent/20 px-1 py-px text-[9px] font-bold uppercase text-accent"
                  >
                    <Star size={9} aria-hidden fill="currentColor" /> Principal
                  </span>
                )}

                {order > 0 && (
                  <span className="inline-flex w-fit items-center gap-1">
                    <span
                      data-testid={`secondary-order-${t.code}`}
                      aria-hidden
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                      style={{
                        backgroundColor: getThemeToken(t.code).color,
                        color: readableTextColor(getThemeToken(t.code).color),
                      }}
                    >
                      {order}
                    </span>
                    <span className="text-[9px] uppercase text-ink-muted">secondaire</span>
                    <button
                      type="button"
                      data-testid={`promote-${t.code}`}
                      aria-label={`Définir « ${t.label} » comme thème principal`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPromote(t.code);
                      }}
                      className="inline-flex items-center gap-0.5 rounded px-1 text-[9px] uppercase text-ink-muted hover:bg-panel-muted hover:text-accent"
                      title="Définir comme principal"
                    >
                      <Star size={10} aria-hidden /> principal
                    </button>
                  </span>
                )}

                {disabled && (
                  <span className="text-[9px] uppercase text-ink-muted">principal uniquement</span>
                )}
              </span>
              {/* ✕ RETIRER explicite (le clic du tile bascule aussi) : rend le toggle clair.
                  Retirer le principal promeut le 1er secondaire (sanitize côté store). */}
              {selected && (
                <button
                  type="button"
                  data-testid={`deselect-${t.code}`}
                  aria-label={`Retirer « ${t.label} »`}
                  title="Retirer ce thème"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(t.code);
                  }}
                  className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <X size={12} aria-hidden />
                </button>
              )}
            </li>
          );
        })}
        {options.length === 0 && (
          <li className="col-span-2 px-2 py-3 text-sm text-ink-muted">Aucun thème</li>
        )}
      </ul>

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
