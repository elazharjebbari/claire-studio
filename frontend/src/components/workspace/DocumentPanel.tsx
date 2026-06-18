"use client";

/**
 * Panneau central — document en lecture/annotation. Colonne ~70ch, line-height 1.7,
 * thème sombre doux (F6). Chaque phrase est indexée et cliquable (pose d'ancre, F1).
 * Surlignage injustice CLAUDETTE (F12) et bandeau coloré de clause à l'ancre.
 * Fantômes LLM affichés en pointillés (F2).
 */

import { useEffect, useRef } from "react";
import type { ReferenceLabel, Sentence } from "@/types/contract";
import { useWorkspaceStore } from "@/store/workspace";
import { getThemeToken } from "@/lib/tokens";
import { cn } from "@/lib/cn";
import { unfairnessStyle, useUnfairnessIndex, type UnfairnessMark } from "./useUnfairness";

export function DocumentPanel({
  sentences,
  referenceLabels,
}: {
  sentences: Sentence[];
  referenceLabels: ReferenceLabel[];
}) {
  const focused = useWorkspaceStore((s) => s.focusedSentence);
  const focusSentence = useWorkspaceStore((s) => s.focusSentence);
  const setBoundary = useWorkspaceStore((s) => s.setBoundary);
  const drafts = useWorkspaceStore((s) => s.draftClauses);
  const selectClause = useWorkspaceStore((s) => s.selectClause);
  const showUnfairness = useWorkspaceStore((s) => s.showUnfairness);
  const showGhostClaude = useWorkspaceStore((s) => s.showGhostClaude);
  const showGhostCodex = useWorkspaceStore((s) => s.showGhostCodex);
  const ghosts = useWorkspaceStore((s) => s.ghostClauses);

  const unfairIndex = useUnfairnessIndex(referenceLabels);
  const anchorByIndex = new Map(drafts.map((d) => [d.anchorIndex, d]));
  const ghostByIndex = new Map(
    ghosts
      .filter((g) => (g.judge === "claude" ? showGhostClaude : showGhostCodex))
      .map((g) => [g.anchorIndex, g]),
  );

  const focusedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    focusedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focused]);

  return (
    <div className="mx-auto max-w-reading px-6 py-8 font-reading text-[17px] leading-reading text-ink">
      {sentences.map((s) => {
        const isFocused = s.index === focused;
        const anchor = anchorByIndex.get(s.index);
        const ghost = ghostByIndex.get(s.index);
        const mark: UnfairnessMark | undefined = showUnfairness
          ? unfairIndex.get(s.index)
          : undefined;
        const themeColor = anchor ? getThemeToken(anchor.theme).color : undefined;

        return (
          <div key={s.id} data-sentence-index={s.index} className="group relative">
            {anchor && (
              <div
                className="mb-1 mt-3 flex items-center gap-2 border-l-2 pl-2 text-[11px] font-semibold uppercase tracking-wide"
                style={{ borderColor: themeColor, color: themeColor }}
              >
                ▸ Début de clause · {getThemeToken(anchor.theme).label}
                {anchor.seededFrom && (
                  <span className="rounded bg-panel-muted px-1 font-mono text-[9px] text-ink-muted">
                    {anchor.seededFrom}
                  </span>
                )}
              </div>
            )}
            <div
              ref={isFocused ? focusedRef : undefined}
              role="button"
              tabIndex={0}
              data-testid={`sentence-${s.index}`}
              data-focused={isFocused || undefined}
              data-anchor={anchor ? true : undefined}
              onClick={() => {
                focusSentence(s.index);
                if (anchor) selectClause(anchor.localId);
                else setBoundary(s.index);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  focusSentence(s.index);
                  if (!anchor) setBoundary(s.index);
                }
              }}
              className={cn(
                "relative -mx-2 cursor-pointer rounded-md px-2 py-1 transition-colors",
                isFocused ? "bg-accent/10 ring-1 ring-accent/40" : "hover:bg-panel/40",
                ghost && !anchor ? "outline-dashed outline-1 outline-ink-muted/40" : "",
              )}
              style={anchor ? { borderLeft: `3px solid ${themeColor}` } : undefined}
            >
              <span
                aria-hidden
                className="mr-2 select-none font-mono text-[11px] text-ink-muted"
              >
                {s.index}
              </span>
              {mark ? (
                <span
                  className="unfairness-mark"
                  style={unfairnessStyle(mark)}
                  title={`Injustice ${mark.label} · niveau ${mark.level}`}
                  data-testid={`unfairness-${s.index}`}
                >
                  {s.rawText}
                </span>
              ) : (
                <span>{s.rawText}</span>
              )}
              {ghost && !anchor && (
                <span className="ml-2 rounded bg-panel-muted px-1 font-mono text-[9px] text-ink-muted">
                  fantôme {ghost.judge}:{ghost.theme}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
