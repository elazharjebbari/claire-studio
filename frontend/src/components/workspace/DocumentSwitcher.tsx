"use client";

/**
 * DocumentSwitcher (point 0b) — barre de navigation entre documents du projet.
 *
 * - Combobox avec **recherche autocomplétée** (titre / identifiant) sur les documents
 *   assignés du projet (source : assignments → document + annotationId + statut).
 * - **Voyant « brouillon non enregistré »** sur le document courant si le store est
 *   `dirty`, et badge de statut (draft/submitted/validated) par entrée.
 * - Sélection → navigation vers l'annotation du document choisi.
 *
 * Accessible : combobox ARIA, navigation clavier (↑/↓/Entrée/Échap), fermeture au clic
 * extérieur. Pour la recherche globale avancée, ⌘K reste disponible.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useAssignments } from "@/lib/api/hooks";
import { useWorkspaceStore } from "@/store/workspace";

const STATUS_LABEL: Record<string, string> = {
  unstarted: "à faire",
  draft: "brouillon",
  submitted: "soumis",
  validated: "validé",
};

export function DocumentSwitcher({
  projectSlug,
  currentDocumentId,
}: {
  projectSlug: string;
  currentDocumentId: string;
}) {
  const router = useRouter();
  const dirty = useWorkspaceStore((s) => s.dirty);
  const { data } = useAssignments(projectSlug);
  const rows = useMemo(() => data?.results ?? [], [data]);

  const current = rows.find((r) => r.document.id === currentDocumentId);
  const currentTitle = current?.document.title ?? "Document";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    // Coercition String : en mode réel, document.id (pk Django) est NUMÉRIQUE →
    // .toLowerCase() planterait. On normalise tous les champs en chaîne.
    const has = (v: unknown) => String(v ?? "").toLowerCase().includes(q);
    return rows.filter(
      (r) => has(r.document.title) || has(r.document.externalId) || has(r.document.id),
    );
  }, [rows, query]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(annotationId?: string) {
    if (!annotationId) return;
    setOpen(false);
    setQuery("");
    router.push(`/annotate/${annotationId}`);
  }

  return (
    <div ref={boxRef} className="relative" data-testid="document-switcher">
      <button
        type="button"
        data-testid="document-switcher-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-[22rem] items-center gap-2 rounded-md border border-line bg-panel-muted/40 px-2 py-1 text-sm text-ink hover:bg-panel-muted"
      >
        <span className="truncate">{currentTitle}</span>
        {current?.document.hasTranslation && (
          <span
            data-testid="doc-translated-current"
            title="Traduction FR disponible"
            className="inline-flex shrink-0 items-center gap-0.5 rounded bg-sky-400/15 px-1 text-[9px] font-semibold text-sky-300"
          >
            <Languages size={10} aria-hidden /> FR
          </span>
        )}
        {dirty && (
          <span
            data-testid="draft-indicator"
            title="Modifications non enregistrées"
            className="ml-1 shrink-0 rounded bg-amber-400/15 px-1 text-[10px] font-semibold text-amber-300"
          >
            ● brouillon
          </span>
        )}
        <span aria-hidden className="text-ink-muted">▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Documents du projet"
          className="absolute left-0 z-50 mt-1 w-80 rounded-lg border border-line bg-elevated p-2 shadow-xl"
        >
          <input
            autoFocus
            data-testid="document-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(filtered[active]?.annotationId);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Rechercher un document…"
            aria-label="Rechercher un document"
            className="mb-2 w-full rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink"
          />
          <ul className="max-h-72 overflow-auto">
            {filtered.length === 0 && (
              <li className="px-2 py-1.5 text-xs text-ink-muted">Aucun document.</li>
            )}
            {filtered.map((r, i) => {
              const isCurrent = r.document.id === currentDocumentId;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    data-testid={`document-option-${r.document.id}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.annotationId)}
                    className={
                      "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm " +
                      (i === active ? "bg-accent/10" : "hover:bg-panel-muted")
                    }
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {isCurrent && <span aria-hidden className="text-accent">›</span>}
                      <span className="truncate text-ink">{r.document.title}</span>
                      {r.document.hasTranslation && (
                        <span
                          data-testid={`doc-translated-${r.document.id}`}
                          title="Traduction FR disponible"
                          className="inline-flex shrink-0 items-center gap-0.5 rounded bg-sky-400/15 px-1 text-[9px] font-semibold text-sky-300"
                        >
                          <Languages size={10} aria-hidden /> FR
                        </span>
                      )}
                      {isCurrent && dirty && (
                        <span className="shrink-0 rounded bg-amber-400/15 px-1 text-[9px] font-semibold text-amber-300">
                          ● brouillon
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 rounded bg-panel-muted px-1 text-[9px] uppercase text-ink-muted">
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
