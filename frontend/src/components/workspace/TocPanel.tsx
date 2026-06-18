"use client";

/**
 * Panneau gauche — Plan / TOC : clauses du document (thèmes colorés), progression,
 * sauts rapides, et toggles d'overlays (injustice, fantôme LLM). navigation.md §3.
 */

import { ClauseChip } from "@/components/ui/ClauseChip";
import { useWorkspaceStore } from "@/store/workspace";

export function TocPanel({ docTitle }: { docTitle: string }) {
  const drafts = useWorkspaceStore((s) => s.draftClauses);
  const selectedId = useWorkspaceStore((s) => s.selectedClauseId);
  const selectClause = useWorkspaceStore((s) => s.selectClause);
  const focusSentence = useWorkspaceStore((s) => s.focusSentence);
  const nSentences = useWorkspaceStore((s) => s.nSentences);

  const showUnfairness = useWorkspaceStore((s) => s.showUnfairness);
  const toggleUnfairness = useWorkspaceStore((s) => s.toggleUnfairness);
  const showGhostClaude = useWorkspaceStore((s) => s.showGhostClaude);
  const showGhostCodex = useWorkspaceStore((s) => s.showGhostCodex);
  const toggleGhost = useWorkspaceStore((s) => s.toggleGhost);
  // Overlay « Traduction (FR) » branché sur le mode de langue (P10) : coché = FR,
  // décoché = VO. Bascule cohérente avec le switch segmenté du DocumentPanel.
  const displayLang = useWorkspaceStore((s) => s.displayLang);
  const setDisplayLang = useWorkspaceStore((s) => s.setDisplayLang);
  const frActive = displayLang === "fr";

  const coverage = nSentences > 0 ? Math.round((drafts.length / nSentences) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">{docTitle}</h2>
        <p className="text-xs text-ink-muted">
          {drafts.length} clause(s) · {nSentences} phrases
        </p>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-muted"
          role="progressbar"
          aria-label={`Couverture ${coverage}%`}
          aria-valuenow={coverage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${coverage}%` }}
            aria-hidden
          />
        </div>
      </div>

      <nav aria-label="Plan des clauses" className="flex flex-col gap-1">
        {drafts.length === 0 && (
          <p className="rounded-md border border-dashed border-line p-3 text-xs text-ink-muted">
            Aucune clause. Cliquez une phrase ou appuyez sur <kbd>B</kbd> pour poser une ancre.
          </p>
        )}
        {drafts.map((c) => (
          <ClauseChip
            key={c.localId}
            themeCode={c.theme}
            anchorIndex={c.anchorIndex}
            selected={selectedId === c.localId}
            ghost={Boolean(c.seededFrom)}
            onClick={() => {
              selectClause(c.localId);
              focusSentence(c.anchorIndex);
            }}
            className="w-full justify-start"
          />
        ))}
      </nav>

      <fieldset className="mt-2 rounded-md border border-line p-2">
        <legend className="px-1 text-[11px] font-semibold uppercase text-ink-muted">
          Overlays
        </legend>
        <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink">
          <input
            type="checkbox"
            data-testid="toggle-unfairness"
            checked={showUnfairness}
            onChange={toggleUnfairness}
          />
          Injustice CLAUDETTE
        </label>
        <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink">
          <input
            type="checkbox"
            data-testid="toggle-ghost-claude"
            checked={showGhostClaude}
            onChange={() => toggleGhost("claude")}
          />
          Fantôme LLM · claude
        </label>
        <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink">
          <input
            type="checkbox"
            data-testid="toggle-ghost-codex"
            checked={showGhostCodex}
            onChange={() => toggleGhost("codex")}
          />
          Fantôme LLM · codex
        </label>
        <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink">
          <input
            type="checkbox"
            data-testid="toggle-translation"
            checked={frActive}
            onChange={() => setDisplayLang(frActive ? "orig" : "fr")}
          />
          Traduction (FR)
        </label>
      </fieldset>
    </div>
  );
}
