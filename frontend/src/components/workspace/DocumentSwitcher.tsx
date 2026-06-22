"use client";

/**
 * DocumentSwitcher (ADR-001) — navigation entre LES DOCUMENTS DE MA SESSION.
 *
 * - Source : `useProjectDocuments(slug, {mine:true})` → **une entrée par document**
 *   (jamais dupliqué, contrairement à l'ancienne dérivation des assignations qui
 *   affichait 1 ligne par couple document×annotateur).
 * - Ouverture : `createAnnotation({project, document})` → ouvre **TOUJOURS MA**
 *   session (get_or_create idempotent), jamais celle d'un autre annotateur.
 * - **Voyant « brouillon non enregistré »** sur le document courant si `dirty`, et
 *   badge de statut par entrée (à faire / brouillon / soumis / validé).
 *
 * Accessible : combobox ARIA, navigation clavier (↑/↓/Entrée/Échap), fermeture au clic
 * extérieur. Pour la recherche globale avancée, ⌘K reste disponible.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useProjectDocuments } from "@/lib/api/hooks";
import { createAnnotation } from "@/lib/api/endpoints";
import { useWorkspaceStore } from "@/store/workspace";

const STATUS_LABEL: Record<string, string> = {
  unstarted: "à faire",
  draft: "brouillon",
  submitted: "soumis",
  in_review: "en revue",
  approved: "validé",
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
  // Mes documents (1 entrée/document) — jamais l'union des assignations.
  const { data } = useProjectDocuments(projectSlug, { mine: true });
  const rows = useMemo(() => data?.results ?? [], [data]);

  const current = rows.find((r) => String(r.document.id) === String(currentDocumentId));
  const currentTitle = current?.document.title ?? "Document";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [opening, setOpening] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    // Coercition String : document.id (pk Django) est NUMÉRIQUE en mode réel →
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

  async function go(externalId?: string) {
    if (!externalId || opening) return;
    setOpening(true);
    try {
      // Ouvre/retrouve TOUJOURS MA session pour ce document (idempotent, INV-4).
      const ann = await createAnnotation({ project: projectSlug, document: externalId });
      setOpen(false);
      setQuery("");
      router.push(`/annotate/${ann.id}`);
    } finally {
      setOpening(false);
    }
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
          aria-label="Documents de ma session"
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
                go(filtered[active]?.document.externalId);
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
              const isCurrent = String(r.document.id) === String(currentDocumentId);
              const status = r.mySession?.status ?? "unstarted";
              return (
                <li key={r.document.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    data-testid={`document-option-${r.document.id}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.document.externalId)}
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
                      {STATUS_LABEL[status] ?? status}
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
