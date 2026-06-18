"use client";

/**
 * CertaintyPicker — échelle de certitude intuitive 0–3 (F10, vocabulary.yaml).
 * Boutons emoji + libellé + raccourci clavier. ARIA radiogroup.
 */

import { cn } from "@/lib/cn";
import { CERTAINTY_SCALE } from "@/lib/tokens";
import type { Certainty } from "@/types/contract";

export interface CertaintyPickerProps {
  value: Certainty | null | undefined;
  onChange: (value: Certainty) => void;
  size?: "sm" | "md";
  label?: string;
}

export function CertaintyPicker({
  value,
  onChange,
  size = "md",
  label = "Certitude",
}: CertaintyPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid="certainty-picker"
      className="flex items-center gap-1"
    >
      {CERTAINTY_SCALE.map((c) => {
        const selected = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${c.label} (${c.shortcut})`}
            title={`${c.label} — touche ${c.shortcut}`}
            data-testid={`certainty-${c.value}`}
            onClick={() => onChange(c.value as Certainty)}
            className={cn(
              "flex flex-col items-center rounded-md border transition-all",
              size === "sm" ? "px-1.5 py-1 text-base" : "px-2.5 py-1.5 text-lg",
              selected
                ? "border-transparent ring-2"
                : "border-line hover:bg-panel-muted",
            )}
            style={
              selected
                ? ({
                    backgroundColor: `${c.color}22`,
                    "--tw-ring-color": c.color,
                  } as React.CSSProperties)
                : undefined
            }
          >
            <span aria-hidden>{c.emoji}</span>
            {size === "md" && (
              <span className="text-[10px] font-medium text-ink-muted">{c.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
