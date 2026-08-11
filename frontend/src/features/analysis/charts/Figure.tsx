"use client";

/**
 * Enveloppe commune des figures : cadre SVG, titre, légende, export, équivalent
 * tabulaire accessible.
 *
 * Trois règles y sont tenues une fois pour toutes, plutôt que répétées dans chaque
 * figure (où elles finiraient par diverger) :
 *
 * 1. **Un équivalent tabulaire existe toujours.** Il sert le lecteur d'écran ET
 *    alimente l'export CSV : un relecteur d'article demande les nombres, pas l'image.
 * 2. **L'export SVG est une sérialisation du DOM**, pas une conversion — c'est ce qui
 *    justifie d'avoir écrit les graphes à la main.
 * 3. **Un état vide dit quoi faire**, jamais un cadre blanc.
 */

import { useId, useMemo, useRef, useState } from "react";
import { Download, Table2 } from "lucide-react";

import { TEXTURE_ID, VIZ_VARS } from "./palette";

export interface FigureColumn {
  key: string;
  label: string;
}

export interface FigureProps {
  title: string;
  subtitle?: string;
  /** Rappel du n et de l'unité — une figure sans effectif n'est pas lisible. */
  caption?: string;
  width?: number;
  height?: number;
  /** Données de l'équivalent tabulaire (et de l'export CSV). */
  columns: FigureColumn[];
  rows: Array<Record<string, string | number | null>>;
  /** Message affiché quand il n'y a rien à montrer — DOIT dire quoi faire. */
  emptyMessage?: string;
  legend?: Array<{ label: string; color: string; shape?: "square" | "line" }>;
  children: React.ReactNode;
  testId?: string;
}

export function toCsv(columns: FigureColumn[], rows: FigureProps["rows"]): string {
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => escape(row[c.key])).join(","));
  return [header, ...body].join("\n");
}

export function Figure({
  title,
  subtitle,
  caption,
  width = 640,
  height = 320,
  columns,
  rows,
  emptyMessage = "Pas encore de données pour cette figure.",
  legend,
  children,
  testId,
}: FigureProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  const descId = useId();

  const csv = useMemo(() => toCsv(columns, rows), [columns, rows]);

  const download = (content: string, mime: string, extension: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^\w-]+/g, "-").toLowerCase()}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportSvg = () => {
    if (!svgRef.current) return;
    // Sérialisation directe du DOM : la figure exportée EST celle affichée.
    download(new XMLSerializer().serializeToString(svgRef.current), "image/svg+xml", "svg");
  };

  const isEmpty = rows.length === 0;

  return (
    <figure className="rounded-lg border border-line bg-panel p-4" data-testid={testId}>
      <figcaption className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink" id={titleId}>
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {!isEmpty && (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="rounded border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink"
              aria-pressed={showTable}
              title="Afficher les valeurs sous forme de tableau"
              data-testid={testId ? `${testId}-table-toggle` : undefined}
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Afficher le tableau des valeurs</span>
            </button>
            <button
              type="button"
              onClick={exportSvg}
              className="rounded border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink"
              title="Exporter la figure en SVG vectoriel"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Exporter en SVG</span>
            </button>
            <button
              type="button"
              onClick={() => download(csv, "text/csv", "csv")}
              className="rounded border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink"
              title="Exporter les données sous-jacentes en CSV"
            >
              CSV
            </button>
          </div>
        )}
      </figcaption>

      {isEmpty ? (
        <p
          className="rounded border border-dashed border-line px-4 py-8 text-center text-xs text-ink-muted"
          data-testid={testId ? `${testId}-empty` : undefined}
        >
          {emptyMessage}
        </p>
      ) : (
        <>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full"
            role="img"
            aria-labelledby={`${titleId} ${descId}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <desc id={descId}>
              {subtitle ? `${title} — ${subtitle}` : title}
              {caption ? ` (${caption})` : ""}
            </desc>
            <defs>
              {/* Texture disponible pour l'impression et les contrastes forcés :
                  l'identité ne doit jamais reposer sur la seule couleur. */}
              <pattern
                id={TEXTURE_ID}
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="6" stroke={VIZ_VARS.ink} strokeWidth="1.5" />
              </pattern>
            </defs>
            {children}
          </svg>

          {legend && legend.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {legend.map((item) => (
                <li key={item.label} className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span
                    aria-hidden
                    className={item.shape === "line" ? "h-0.5 w-4" : "h-2.5 w-2.5 rounded-sm"}
                    style={{ background: item.color }}
                  />
                  {item.label}
                </li>
              ))}
            </ul>
          )}

          {caption && <p className="mt-2 text-[11px] text-ink-muted">{caption}</p>}

          {/* Toujours présent dans le DOM : visuellement masqué par défaut, lisible par
              lecteur d'écran, et déplié par le bouton pour tout le monde. */}
          <div className={showTable ? "mt-3 overflow-x-auto" : "sr-only"}>
            <table className="w-full text-xs" data-testid={testId ? `${testId}-table` : undefined}>
              <caption className="sr-only">{title} — valeurs</caption>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} scope="col" className="px-2 py-1 text-left text-ink-muted">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-t border-line">
                    {columns.map((column) => (
                      <td key={column.key} className="px-2 py-1 text-ink">
                        {row[column.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </figure>
  );
}
