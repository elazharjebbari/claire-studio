"use client";

/** Petit tableau admin réutilisable (en-têtes + lignes). */

import { Panel } from "@/components/ui/primitives";

export function AdminScaffold({
  title,
  description,
  columns,
  rows,
  actions,
}: {
  title: string;
  description?: string;
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          {description && <p className="text-sm text-ink-muted">{description}</p>}
        </div>
        {actions}
      </div>
      <Panel className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-panel-muted text-left text-xs uppercase text-ink-muted">
              {columns.map((c) => (
                <th key={c} className="px-4 py-2 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                {r.map((cell, j) => (
                  <td key={j} className="px-4 py-2 text-ink">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
