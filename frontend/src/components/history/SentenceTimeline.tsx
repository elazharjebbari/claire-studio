"use client";

/**
 * SentenceTimeline (point 6) — évolution de l'annotation d'UNE phrase à travers les
 * annotateurs et les versions. Projection de l'audit (sentence-history). Chaque ligne :
 * pastille couleur d'auteur, verbe, before→after, version, horodatage, « pourquoi ».
 */

import { useState } from "react";
import { useSentenceHistory } from "@/lib/api/hooks";
import { getThemeToken } from "@/lib/tokens";

function label(after: string | null | undefined): string {
  if (!after) return "—";
  // Si c'est un code de thème connu, afficher son libellé ; sinon brut (ex. certitude).
  const t = getThemeToken(after);
  return t.code === after ? t.label : after;
}

export function SentenceTimeline({ documentId }: { documentId: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const { data, isLoading } = useSentenceHistory(documentId, index);

  return (
    <div data-testid="sentence-timeline">
      <form
        className="mb-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(input);
          setIndex(Number.isInteger(n) && n >= 0 ? n : null);
        }}
      >
        <label htmlFor="sentence-index" className="text-sm text-ink-muted">
          Phrase n°
        </label>
        <input
          id="sentence-index"
          data-testid="sentence-index-input"
          inputMode="numeric"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ex. 16"
          className="w-24 rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink"
        />
        <button
          type="submit"
          data-testid="sentence-history-go"
          className="rounded-md border border-line px-2 py-1 text-xs text-ink hover:bg-panel-muted"
        >
          Voir l'historique
        </button>
      </form>

      {index == null && (
        <p className="text-sm text-ink-muted">
          Entrez un numéro de phrase pour voir comment son annotation a évolué.
        </p>
      )}
      {index != null && isLoading && <p className="text-sm text-ink-muted">Chargement…</p>}
      {index != null && !isLoading && (data?.results.length ?? 0) === 0 && (
        <p className="text-sm text-ink-muted" data-testid="sentence-history-empty">
          Aucune modification enregistrée pour la phrase {index}.
        </p>
      )}

      {index != null && (data?.results.length ?? 0) > 0 && (
        <ol className="relative ml-3 border-l border-line">
          {data!.results.map((e, i) => (
            <li key={i} className="mb-3 ml-4" data-testid="sentence-history-entry">
              <span
                aria-hidden
                className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full"
                style={{ backgroundColor: e.actorColor }}
              />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                {e.version != null && (
                  <span className="rounded bg-panel-muted px-1 font-mono text-[10px] text-ink-muted">
                    v{e.version}
                  </span>
                )}
                <span className="font-medium text-ink">{e.actorName}</span>
                <span className="text-ink-muted">{e.verb}</span>
                <span className="text-ink-muted">
                  {label(e.before)} → <span className="text-ink">{label(e.after)}</span>
                </span>
                <span className="ml-auto text-[10px] text-ink-muted">
                  {new Date(e.createdAt).toLocaleString("fr-FR")}
                </span>
              </div>
              {e.rationale && <p className="mt-0.5 text-xs italic text-ink-muted">« {e.rationale} »</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
