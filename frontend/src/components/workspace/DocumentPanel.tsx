"use client";

/**
 * Panneau central — document en lecture/annotation. Colonne ~70ch, line-height 1.7,
 * thème sombre doux (F6). Chaque phrase est indexée et cliquable (pose d'ancre, F1).
 * Surlignage injustice CLAUDETTE (F12) et bandeau coloré de clause à l'ancre.
 * Fantômes LLM affichés en pointillés (F2).
 *
 * Refonte ergonomique (document-panel-redesign.md) :
 *  - P2 : runs de thème → rail coloré gauche continu + frontières pointillées togglables.
 *  - P3 : menu phrase au long-press / clic-droit (annotation fine + accord LLM).
 *  - P4 : multi-sélection (Shift / Cmd|Ctrl + clic) + barre flottante d'actions.
 *  - P5 : traduction FR sous la phrase (phrase / sélection / document).
 *
 * IMPORTANT : le clic SIMPLE conserve son comportement (focus + pose/sélection d'ancre).
 * Les nouvelles interactions s'AJOUTENT sans le remplacer.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReferenceLabel, Sentence } from "@/types/contract";
import { useWorkspaceStore } from "@/store/workspace";
import { getThemeToken } from "@/lib/tokens";
import { computeRuns, runAt } from "@/lib/runs";
import { useDocumentTranslations } from "@/lib/api/hooks";
import { cn } from "@/lib/cn";
import { unfairnessStyle, useUnfairnessIndex, type UnfairnessMark } from "./useUnfairness";
import { useLongPress } from "./useLongPress";
import { SentenceMenu } from "./SentenceMenu";
import { SelectionToolbar } from "./SelectionToolbar";

interface MenuState {
  index: number;
  x: number;
  y: number;
}

export function DocumentPanel({
  sentences,
  referenceLabels,
  documentId,
}: {
  sentences: Sentence[];
  referenceLabels: ReferenceLabel[];
  documentId?: string;
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
  const nSentences = useWorkspaceStore((s) => s.nSentences);

  const showBoundaries = useWorkspaceStore((s) => s.showBoundaries);
  const toggleBoundaries = useWorkspaceStore((s) => s.toggleBoundaries);
  const selectedSentences = useWorkspaceStore((s) => s.selectedSentences);
  const selectRange = useWorkspaceStore((s) => s.selectRange);
  const toggleSelected = useWorkspaceStore((s) => s.toggleSelected);
  const translateAll = useWorkspaceStore((s) => s.translateAll);
  const toggleTranslateAll = useWorkspaceStore((s) => s.toggleTranslateAll);
  const translatedSentences = useWorkspaceStore((s) => s.translatedSentences);

  const unfairIndex = useUnfairnessIndex(referenceLabels);
  const anchorByIndex = useMemo(
    () => new Map(drafts.map((d) => [d.anchorIndex, d])),
    [drafts],
  );
  const ghostByIndex = useMemo(
    () =>
      new Map(
        ghosts
          .filter((g) => (g.judge === "claude" ? showGhostClaude : showGhostCodex))
          .map((g) => [g.anchorIndex, g]),
      ),
    [ghosts, showGhostClaude, showGhostCodex],
  );

  // Runs de clause (P2) : mémoïsés sur les ancres + nombre de phrases.
  const runs = useMemo(
    () => computeRuns(drafts.map((d) => ({ ...d })), nSentences || sentences.length),
    [drafts, nSentences, sentences.length],
  );

  // Traductions FR (P5) — Map index→texte.
  const { byIndex: translations } = useDocumentTranslations(documentId);

  const selectedSet = useMemo(() => new Set(selectedSentences), [selectedSentences]);

  const [menu, setMenu] = useState<MenuState | null>(null);
  // Dernière phrase ayant reçu le focus (point d'ancrage de Shift+clic).
  const lastFocusedRef = useRef(focused);
  useEffect(() => {
    lastFocusedRef.current = focused;
  }, [focused]);

  const focusedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // `scrollIntoView` peut être absent (jsdom, vieux moteurs) → appel optionnel défensif.
    focusedRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [focused]);

  return (
    <>
      <div className="mx-auto max-w-reading px-6 py-8 font-reading text-[17px] leading-reading text-ink">
        <div className="mb-4 flex items-center justify-end gap-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-ink-muted">
            <input
              type="checkbox"
              data-testid="boundary-toggle"
              checked={showBoundaries}
              onChange={toggleBoundaries}
            />
            Frontières
          </label>
          <button
            type="button"
            data-testid="translate-document"
            aria-pressed={translateAll}
            onClick={toggleTranslateAll}
            className={cn(
              "rounded-md border px-2 py-1 transition-colors",
              translateAll
                ? "border-accent bg-accent/10 text-ink"
                : "border-line text-ink-muted hover:bg-panel-muted",
            )}
          >
            🌐 Traduire le document
          </button>
        </div>

        {sentences.map((s) => {
          const isFocused = s.index === focused;
          const anchor = anchorByIndex.get(s.index);
          const ghost = ghostByIndex.get(s.index);
          const mark: UnfairnessMark | undefined = showUnfairness
            ? unfairIndex.get(s.index)
            : undefined;
          const anchorColor = anchor ? getThemeToken(anchor.theme).color : undefined;

          // Run couvrant la phrase (P2) → rail gauche + détection du début de run.
          const run = runAt(runs, s.index);
          const runColor = run?.theme ? getThemeToken(run.theme).color : undefined;
          const isRunStart = run != null && run.start === s.index;
          const showDashedTop = showBoundaries && isRunStart && run!.theme != null;
          const isSelected = selectedSet.has(s.index);
          const showTranslation =
            (translateAll || translatedSentences.includes(s.index)) &&
            translations.get(s.index) != null;

          return (
            <div key={s.id} data-sentence-index={s.index} className="group relative">
              {anchor && (
                <div
                  className="mb-1 mt-3 flex items-center gap-2 border-l-2 pl-2 text-[11px] font-semibold uppercase tracking-wide text-ink"
                  style={{ borderColor: anchorColor }}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: anchorColor }}
                  />
                  ▸ Début de clause · {getThemeToken(anchor.theme).label}
                  {anchor.seededFrom && (
                    <span className="rounded bg-panel-muted px-1 font-mono text-[9px] text-ink-muted">
                      {anchor.seededFrom}
                    </span>
                  )}
                </div>
              )}
              <SentenceRow
                sentence={s}
                isFocused={isFocused}
                isSelected={isSelected}
                hasAnchor={Boolean(anchor)}
                ghost={ghost}
                mark={mark}
                runColor={runColor}
                showDashedTop={showDashedTop}
                isRunStart={isRunStart}
                focusedRef={isFocused ? focusedRef : undefined}
                onActivate={(e) => {
                  // Multi-sélection (P4) — s'AJOUTE au clic simple.
                  if (e.shiftKey) {
                    selectRange(lastFocusedRef.current, s.index);
                    focusSentence(s.index);
                    return;
                  }
                  if (e.metaKey || e.ctrlKey) {
                    toggleSelected(s.index);
                    focusSentence(s.index);
                    return;
                  }
                  // Clic simple : comportement inchangé (focus + pose/sélection d'ancre).
                  focusSentence(s.index);
                  if (anchor) selectClause(anchor.localId);
                  else setBoundary(s.index);
                }}
                onKeyActivate={() => {
                  focusSentence(s.index);
                  if (!anchor) setBoundary(s.index);
                }}
                onOpenMenu={(x, y) => setMenu({ index: s.index, x, y })}
              />
              {showTranslation && (
                <p
                  data-testid={`translation-${s.index}`}
                  className="mb-1 ml-6 mt-0.5 italic text-ink-muted"
                >
                  {translations.get(s.index)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {menu && (
        <SentenceMenu
          sentenceIndex={menu.index}
          x={menu.x}
          y={menu.y}
          runs={runs}
          onClose={() => setMenu(null)}
        />
      )}
      <SelectionToolbar />
    </>
  );
}

/**
 * Ligne de phrase isolée pour pouvoir attacher les handlers de long-press (hook par
 * ligne, sans casser les règles des hooks).
 */
function SentenceRow({
  sentence: s,
  isFocused,
  isSelected,
  hasAnchor,
  ghost,
  mark,
  runColor,
  showDashedTop,
  isRunStart,
  focusedRef,
  onActivate,
  onKeyActivate,
  onOpenMenu,
}: {
  sentence: Sentence;
  isFocused: boolean;
  isSelected: boolean;
  hasAnchor: boolean;
  ghost: { judge: string; theme: string } | undefined;
  mark: UnfairnessMark | undefined;
  runColor: string | undefined;
  showDashedTop: boolean;
  isRunStart: boolean;
  focusedRef: React.RefObject<HTMLDivElement> | undefined;
  onActivate: (e: React.MouseEvent) => void;
  onKeyActivate: () => void;
  onOpenMenu: (x: number, y: number) => void;
}) {
  const longPress = useLongPress((x, y) => onOpenMenu(x, y));

  return (
    <div
      ref={focusedRef}
      role="button"
      tabIndex={0}
      data-testid={`sentence-${s.index}`}
      data-focused={isFocused || undefined}
      data-anchor={hasAnchor ? true : undefined}
      data-selected={isSelected || undefined}
      data-boundary={isRunStart || undefined}
      data-dashed={showDashedTop || undefined}
      {...longPress}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onKeyActivate();
        }
      }}
      className={cn(
        "relative -mx-2 cursor-pointer rounded-md px-2 py-1 transition-colors",
        isFocused ? "bg-accent/10 ring-1 ring-accent/40" : "hover:bg-panel/40",
        isSelected ? "ring-1 ring-accent/70 bg-accent/5" : "",
        ghost && !hasAnchor ? "outline-dashed outline-1 outline-ink-muted/40" : "",
      )}
      style={{
        // Rail gauche coloré par le thème du run (P2) — canal visuel distinct de
        // l'overlay injustice. Opacité modérée via box-shadow inset.
        boxShadow: runColor ? `inset 3px 0 0 ${runColor}80` : undefined,
        // Frontière de clause : trait pointillé subtil au début du run, togglable.
        borderTop: showDashedTop ? "1px dashed rgb(var(--surface-text-muted) / 0.3)" : undefined,
      }}
    >
      <span aria-hidden className="mr-2 select-none font-mono text-[11px] text-ink-muted">
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
      {ghost && !hasAnchor && (
        <span className="ml-2 rounded bg-panel-muted px-1 font-mono text-[9px] text-ink-muted">
          fantôme {ghost.judge}:{ghost.theme}
        </span>
      )}
    </div>
  );
}
