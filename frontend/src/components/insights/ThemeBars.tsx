"use client";

/** Distribution de thèmes en barres horizontales colorées (point 5). */

import { getThemeToken } from "@/lib/tokens";

export function ThemeBars({ data }: { data: { theme: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="flex flex-col gap-1.5" data-testid="theme-distribution">
      {data.map((d) => {
        const t = getThemeToken(d.theme);
        return (
          <li key={d.theme} className="flex items-center gap-2 text-xs">
            <span className="w-44 shrink-0 truncate text-ink-muted" title={t.label}>
              {t.label}
            </span>
            <span className="relative h-3 flex-1 overflow-hidden rounded bg-panel-muted">
              <span
                className="absolute inset-y-0 left-0 rounded"
                style={{ width: `${(d.count / max) * 100}%`, backgroundColor: t.color }}
              />
            </span>
            <span className="w-6 shrink-0 text-right font-mono text-ink">{d.count}</span>
          </li>
        );
      })}
    </ul>
  );
}
