"use client";

/**
 * Centre d'aide in-app (navigation.md §2 « ouvrir l'aide »). Mise en page 2 colonnes :
 * barre latérale de navigation (groupes + sections du manifeste) + contenu Markdown
 * rendu via react-markdown. Recherche simple par titre. Le contenu est piloté par les
 * fichiers `content/help/*.md` (éditables) référencés par le manifeste.
 */

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  HELP_MANIFEST,
  helpGroups,
  helpSection,
  type HelpSection,
} from "../../../../content/help/manifest";
import { helpContent } from "../../../../content/help";
import { HelpMarkdown } from "@/components/help/HelpMarkdown";

const DEFAULT_SLUG = HELP_MANIFEST[0]?.slug ?? "introduction";

export default function HelpPage() {
  // `useSearchParams` exige un contexte Suspense — isolé dans un enfant, comme dans
  // `LabWorkspace` (même motif, même raison).
  return (
    <Suspense fallback={<div className="p-4 text-xs text-ink-muted">Chargement…</div>}>
      <HelpPageInner />
    </Suspense>
  );
}

function HelpPageInner() {
  const searchParams = useSearchParams();
  // `?s=<slug>` : lien profond vers une section (utilisé par les modales d'aide, ex.
  // LabHelpModal → « Lire les métriques ») ; slug inconnu → section par défaut.
  const requested = searchParams.get("s");
  const [activeSlug, setActiveSlug] = useState<string>(
    requested && helpSection(requested) ? requested : DEFAULT_SLUG,
  );
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return helpGroups();
    return helpGroups()
      .map((g) => ({
        group: g.group,
        sections: g.sections.filter((s) => s.title.toLowerCase().includes(q)),
      }))
      .filter((g) => g.sections.length > 0);
  }, [query]);

  const active: HelpSection | undefined = helpSection(activeSlug);
  const content = helpContent(activeSlug) ?? "# Section introuvable";

  return (
    <div
      data-testid="help-center"
      className="mx-auto flex max-w-6xl gap-8 px-6 py-8"
    >
      <aside className="w-64 shrink-0" aria-label="Sections de l'aide">
        <h1 className="mb-3 text-lg font-semibold text-ink">Centre d&apos;aide</h1>
        <label className="sr-only" htmlFor="help-search">
          Filtrer les sections
        </label>
        <input
          id="help-search"
          data-testid="help-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une section…"
          className="mb-4 w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink placeholder:text-ink-muted"
        />
        <nav className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.group}>
              <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                {g.group}
              </p>
              <ul className="flex flex-col gap-0.5">
                {g.sections.map((s) => {
                  const isActive = s.slug === activeSlug;
                  return (
                    <li key={s.slug}>
                      <button
                        type="button"
                        data-testid={`help-nav-${s.slug}`}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => setActiveSlug(s.slug)}
                        className={cn(
                          "w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                          isActive
                            ? "bg-panel-muted text-ink"
                            : "text-ink-muted hover:bg-panel-muted hover:text-ink",
                        )}
                      >
                        {s.title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="px-1 text-sm text-ink-muted">Aucune section ne correspond.</p>
          )}
        </nav>
      </aside>

      <article className="min-w-0 flex-1" data-testid="help-article" data-slug={activeSlug}>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {active?.group}
        </p>
        <HelpMarkdown source={content} />
      </article>
    </div>
  );
}
