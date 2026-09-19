/**
 * English theme chip for the public page. Colour and glyph come from the frozen specification
 * (`presentTheme`), the wording from `labels.en.ts`; the label is always rendered next to the
 * colour so that colour is never the only carrier of information.
 */

import { presentTheme } from "@/lib/taxonomy/presentation";
import { themeDefinitionEn, themeLabelEn } from "@/lib/taxonomy/labels.en";
import type { TaxonomyId } from "@/lib/taxonomy";

export interface ThemeChipProps {
  /** Theme code (T20 canonical or an already projected T11 code). */
  code: string | null | undefined;
  taxonomy: TaxonomyId;
  size?: "sm" | "md";
  /** `dot` shows only the colour dot with an accessible name (comparison cells). */
  variant?: "chip" | "dot";
  /** Marks a cell that differs from the model's prediction. */
  differs?: boolean;
  testId?: string;
}

export function themeColor(code: string, taxonomy: TaxonomyId): string {
  return presentTheme(code, taxonomy).color;
}

export function ThemeChip({ code, taxonomy, size = "sm", variant = "chip", differs = false, testId }: ThemeChipProps) {
  if (!code) {
    return (
      <span className="text-[11px] text-ink-muted" aria-label="no label" data-testid={testId}>
        —
      </span>
    );
  }
  const p = presentTheme(code, taxonomy);
  const label = themeLabelEn(p.code);
  const title = `${label}${themeDefinitionEn(p.code) ? ` — ${themeDefinitionEn(p.code)}` : ""}${differs ? " (differs from the model)" : ""}`;

  if (variant === "dot") {
    return (
      <span
        data-testid={testId}
        data-theme={p.code}
        role="img"
        aria-label={title}
        title={title}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-semibold leading-none ${
          differs ? "border-ink" : "border-transparent"
        }`}
        style={{ backgroundColor: `${p.color}33`, color: p.color }}
      >
        {differs ? "≠" : ""}
      </span>
    );
  }

  return (
    <span
      data-testid={testId}
      data-theme={p.code}
      title={title}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border font-medium ${
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-[12px]"
      }`}
      style={{ backgroundColor: `${p.color}1A`, color: p.color, borderColor: `${p.color}55` }}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
