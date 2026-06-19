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
 * Q2 : le clic SIMPLE ne crée PLUS de clause — il se contente de FOCUS + sélection
 * mono de la phrase. La création de clause est explicite (thème dans l'inspecteur,
 * menu clic-droit → Annoter). Shift/Cmd-clic et clic-droit/long-press inchangés.
 *
 * Q3 : un sélecteur de source (LlmSourceSwitch) pilote l'affichage :
 *  - `human`   : annotation humaine (rail + puce de la clause humaine).
 *  - `claude`/`codex` : segmentation du juge en lecture seule (rail + puce du juge).
 *  - `compare` : accord par phrase (vert = identique, ambre = divergent) + bandeau
 *    de score (κ + %).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { PreClause, ReferenceLabel, Sentence } from "@/types/contract";
import { useWorkspaceStore } from "@/store/workspace";
import { getThemeToken } from "@/lib/tokens";
import { computeRuns, runAt, type Run } from "@/lib/runs";
import { useAnnotationVersions, useDocumentTranslations, useLlmAgreement } from "@/lib/api/hooks";
import { cn } from "@/lib/cn";
import { unfairnessStyle, useUnfairnessIndex, type UnfairnessMark } from "./useUnfairness";
import { useLongPress } from "./useLongPress";
import { useBlockDragSelect } from "./useBlockDragSelect";
import { SentenceMenu, type JudgeDetail } from "./SentenceMenu";
import { SelectionToolbar } from "./SelectionToolbar";
import { LangSwitch } from "./LangSwitch";
import { LlmSourceSwitch } from "./LlmSourceSwitch";
import { DivergenceNav } from "./DivergenceNav";
import { ComparePanel } from "./ComparePanel";
import { BoundaryEvidence } from "./BoundaryEvidence";
import { useDivergenceShortcuts } from "./useDivergenceShortcuts";
import {
  divergenceAnchors,
  divergenceOrdinal,
  nextDivergence,
  prevDivergence,
} from "@/lib/divergence";

interface MenuState {
  index: number;
  x: number;
  y: number;
}

interface BoundaryPopState {
  index: number;
  x: number;
  y: number;
}

export function DocumentPanel({
  sentences,
  referenceLabels,
  documentId,
  projectSlug,
}: {
  sentences: Sentence[];
  referenceLabels: ReferenceLabel[];
  documentId?: string;
  projectSlug?: string;
}) {
  const focused = useWorkspaceStore((s) => s.focusedSentence);
  const focusSentence = useWorkspaceStore((s) => s.focusSentence);
  const drafts = useWorkspaceStore((s) => s.draftClauses);
  const selectClause = useWorkspaceStore((s) => s.selectClause);
  const resolveDivergence = useWorkspaceStore((s) => s.resolveDivergence);
  const showComparePanel = useWorkspaceStore((s) => s.showComparePanel);
  const toggleComparePanel = useWorkspaceStore((s) => s.toggleComparePanel);
  const showUnfairness = useWorkspaceStore((s) => s.showUnfairness);
  const showGhostClaude = useWorkspaceStore((s) => s.showGhostClaude);
  const showGhostCodex = useWorkspaceStore((s) => s.showGhostCodex);
  const ghosts = useWorkspaceStore((s) => s.ghostClauses);
  const nSentences = useWorkspaceStore((s) => s.nSentences);
  const llmSource = useWorkspaceStore((s) => s.llmSource);

  const showBoundaries = useWorkspaceStore((s) => s.showBoundaries);
  const toggleBoundaries = useWorkspaceStore((s) => s.toggleBoundaries);
  const selectedSentences = useWorkspaceStore((s) => s.selectedSentences);
  const selectRange = useWorkspaceStore((s) => s.selectRange);
  const toggleSelected = useWorkspaceStore((s) => s.toggleSelected);
  const displayLang = useWorkspaceStore((s) => s.displayLang);
  const translatedSentences = useWorkspaceStore((s) => s.translatedSentences);
  const setTranslated = useWorkspaceStore((s) => s.setTranslated);

  const n = nSentences || sentences.length;

  const llmVersion = useWorkspaceStore((s) => s.llmVersion);
  const setLlmVersion = useWorkspaceStore((s) => s.setLlmVersion);
  // Versions LLM disponibles pour ce document (multi-versions).
  const versionsQuery = useAnnotationVersions(documentId);
  const availableVersions = versionsQuery.data?.versions ?? [];

  // Accord LLM (Q3) — projection par phrase + score + détails par juge, pour la version choisie.
  const llm = useLlmAgreement(documentId, projectSlug, llmVersion);

  // Détails (rationale/evidence) d'un juge indexés par ancre → menu phrase enrichi.
  const claudeDetailByAnchor = useMemo(
    () => buildJudgeDetailMap(llm.claudePre?.clauses),
    [llm.claudePre],
  );
  const codexDetailByAnchor = useMemo(
    () => buildJudgeDetailMap(llm.codexPre?.clauses),
    [llm.codexPre],
  );

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

  // Runs de la source ACTIVE (Q3). En `human` → clauses humaines ; en `claude`/`codex`
  // → segmentation du juge ; en `compare` → on s'appuie sur la projection par phrase.
  const humanRuns = useMemo(
    () => computeRuns(drafts.map((d) => ({ ...d })), n),
    [drafts, n],
  );
  const claudeRuns = useMemo(
    () => computeRuns(judgeAnchors(llm.claudePre?.clauses), n),
    [llm.claudePre, n],
  );
  const codexRuns = useMemo(
    () => computeRuns(judgeAnchors(llm.codexPre?.clauses), n),
    [llm.codexPre, n],
  );
  const runs =
    llmSource === "claude" ? claudeRuns : llmSource === "codex" ? codexRuns : humanRuns;
  const isCompare = llmSource === "compare";

  // Divergences (P1) — ancres de segments où Claude ≠ Codex (logique pure).
  const divAnchors = useMemo(
    () => divergenceAnchors(llm.claudeByIndex, llm.codexByIndex),
    [llm.claudeByIndex, llm.codexByIndex],
  );
  const divOrdinal = divergenceOrdinal(divAnchors, focused);
  const goNextDivergence = () => {
    const t = nextDivergence(divAnchors, focused);
    if (t != null) focusSentence(t);
  };
  const goPrevDivergence = () => {
    const t = prevDivergence(divAnchors, focused);
    if (t != null) focusSentence(t);
  };
  // Adoption au clavier (1/2) de la proposition du juge couvrant la phrase focalisée.
  const adoptAtFocus = (judge: "claude" | "codex") => {
    const detail =
      judge === "claude"
        ? detailAt(claudeDetailByAnchor, claudeRuns, focused)
        : detailAt(codexDetailByAnchor, codexRuns, focused);
    if (detail) resolveDivergence(detail.anchorIndex, judge, detail.theme);
  };

  // Popover d'aperçu de frontière (P5) — ouvert au clic sur l'icône ou via `e`.
  const [boundaryPop, setBoundaryPop] = useState<BoundaryPopState | null>(null);
  const openBoundaryAt = (index: number, x?: number, y?: number) => {
    if (x != null && y != null) {
      setBoundaryPop({ index, x, y });
      return;
    }
    // Clavier : ancrer près de la phrase focalisée si on la retrouve dans le DOM.
    const el =
      typeof document !== "undefined"
        ? document.querySelector<HTMLElement>(`[data-sentence-index="${index}"]`)
        : null;
    const r = el?.getBoundingClientRect();
    setBoundaryPop({ index, x: r ? r.right - 40 : 200, y: r ? r.top + 8 : 120 });
  };

  useDivergenceShortcuts({
    compareActive: isCompare,
    onNextDivergence: goNextDivergence,
    onPrevDivergence: goPrevDivergence,
    onAdoptClaude: () => adoptAtFocus("claude"),
    onAdoptCodex: () => adoptAtFocus("codex"),
    onPeekBoundary: () => openBoundaryAt(focused),
    onToggleCompare: toggleComparePanel,
  });

  // Le panneau comparatif n'a de sens que si au moins un juge couvre des phrases.
  const compareDataReady =
    llm.claudeByIndex.some((t) => t != null) || llm.codexByIndex.some((t) => t != null);

  // Détails des juges à la frontière en cours d'aperçu (P5).
  const boundaryClaude = boundaryPop
    ? detailAt(claudeDetailByAnchor, claudeRuns, boundaryPop.index)
    : null;
  const boundaryCodex = boundaryPop
    ? detailAt(codexDetailByAnchor, codexRuns, boundaryPop.index)
    : null;

  // Traductions FR (P5) — Map index→texte.
  const { byIndex: translations } = useDocumentTranslations(documentId);

  // Sélection multi-blocs au bouton droit maintenu (P8).
  const blockDrag = useBlockDragSelect(runs);

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
      <div className="flex justify-center gap-4 px-6 py-8">
       <div className="w-full max-w-reading font-reading text-[17px] leading-reading text-ink">
        <div className="mb-4 flex flex-wrap items-center justify-end gap-3 text-sm">
          {/* P3 : sélecteur de version TOUJOURS visible dès qu'il existe des versions,
              indépendamment de la source. Le switch n'affecte QUE l'overlay LLM
              (clé react-query) ; les clauses humaines ne sont jamais touchées. */}
          {availableVersions.length > 0 && (
            <label className="flex items-center gap-2 text-ink-muted">
              <span>Version</span>
              <select
                data-testid="llm-version-select"
                className="rounded-md border border-line bg-panel px-2 py-1 text-ink"
                value={llmVersion ?? ""}
                onChange={(e) => setLlmVersion(e.target.value || null)}
              >
                <option value="">Auto (plus riche)</option>
                {availableVersions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-ink-muted">
            <input
              type="checkbox"
              data-testid="boundary-toggle"
              checked={showBoundaries}
              onChange={toggleBoundaries}
            />
            Frontières
          </label>
          <LlmSourceSwitch />
          {compareDataReady && (
            <button
              type="button"
              data-testid="toggle-compare-panel"
              aria-pressed={showComparePanel}
              onClick={toggleComparePanel}
              title="Panneau comparatif Claude/Codex — g"
              className={
                "rounded-md border px-2 py-1 transition-colors " +
                (showComparePanel
                  ? "border-accent/60 bg-accent/10 text-ink"
                  : "border-line text-ink-muted hover:bg-panel-muted")
              }
            >
              ⇄ Comparer
            </button>
          )}
          <LangSwitch />
        </div>

        {/* Bandeau de score d'accord (Q3) — affiché en mode comparaison. */}
        {isCompare && (
          <div
            data-testid="compare-banner"
            role="status"
            className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-line bg-panel-muted/50 px-3 py-2 text-sm"
          >
            <span className="font-semibold text-ink">Accord Claude / Codex</span>
            <span data-testid="compare-score" className="text-ink-muted">
              κ&nbsp;<span className="font-mono text-ink">{llm.kappa.toFixed(2)}</span> ·{" "}
              <span className="font-mono text-ink">{Math.round(llm.agreementPct)}%</span>{" "}
              concordant ({llm.support} phrases)
            </span>
            <span className="ml-auto flex items-center gap-3 text-[11px] text-ink-muted">
              <span className="flex items-center gap-1">
                <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-400" /> accord
              </span>
              <span className="flex items-center gap-1">
                <span aria-hidden className="h-2 w-2 rounded-full bg-amber-400" /> divergence
              </span>
            </span>
          </div>
        )}

        {isCompare && (
          <DivergenceNav
            count={divAnchors.length}
            ordinal={divOrdinal}
            onPrev={goPrevDivergence}
            onNext={goNextDivergence}
          />
        )}

        {sentences.map((s) => {
          const isFocused = s.index === focused;
          const anchor = anchorByIndex.get(s.index);
          const ghost = ghostByIndex.get(s.index);
          const mark: UnfairnessMark | undefined = showUnfairness
            ? unfairIndex.get(s.index)
            : undefined;

          // Projection par phrase de chaque juge (Q3).
          const claudeTheme = llm.claudeByIndex[s.index] ?? null;
          const codexTheme = llm.codexByIndex[s.index] ?? null;
          const bothPresent = claudeTheme != null && codexTheme != null;
          const compareAgree = bothPresent && claudeTheme === codexTheme;

          // Frontière LLM (P5) : début d'un run Claude OU Codex sur cette phrase.
          // L'aperçu de preuves est disponible dès qu'il existe des données LLM,
          // quelle que soit la source affichée (y compris en mode Humain), pour
          // arbitrer sans changer de vue. Discret : un simple liseré + l'icône 👁.
          const claudeStart = runAt(claudeRuns, s.index);
          const codexStart = runAt(codexRuns, s.index);
          const llmFrontier =
            compareDataReady &&
            showBoundaries &&
            ((claudeStart?.start === s.index && claudeStart.theme != null) ||
              (codexStart?.start === s.index && codexStart.theme != null));

          // Run couvrant la phrase (P2) → rail gauche + détection du début de run.
          const run = runAt(runs, s.index);
          let runColor = run?.theme ? getThemeToken(run.theme).color : undefined;
          const isRunStart = run != null && run.start === s.index;
          let showDashedTop = showBoundaries && isRunStart && run!.theme != null;

          // En comparaison, le rail traduit l'ACCORD (vert/ambre) et non un thème.
          if (isCompare) {
            runColor =
              claudeTheme == null && codexTheme == null
                ? undefined
                : compareAgree
                  ? "#34D399" // emerald-400
                  : "#FBBF24"; // amber-400
            showDashedTop = false;
          }

          // En-tête de clause/puce de thème selon la source active (Q3).
          const badge = computeBadge({
            llmSource,
            anchor: anchor ? { theme: anchor.theme, seededFrom: anchor.seededFrom } : null,
            run,
            isRunStart,
            claudeTheme,
            codexTheme,
            compareAgree,
            bothPresent,
          });

          const isSelected = selectedSet.has(s.index);
          const frText = translations.get(s.index);
          // Surcouche per-phrase (P9) — ne s'applique qu'en mode orig/both.
          const perSentenceFr =
            displayLang !== "fr" &&
            (displayLang === "both" || translatedSentences.includes(s.index)) &&
            frText != null;
          // En mode `fr`, le texte affiché EST le FR (repli VO si absent).
          const renderFr = displayLang === "fr";
          const missingFr = renderFr && frText == null;

          return (
            <div key={s.id} data-sentence-index={s.index} className="group relative">
              {badge && (
                <div
                  data-testid="clause-badge"
                  className="mb-0.5 mt-3 flex items-center gap-1.5 pl-2 text-ink-muted"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: badge.color }}
                  />
                  <span className="text-[12px] font-medium text-ink">{badge.label}</span>
                  {badge.tag && (
                    <span className="rounded bg-panel-muted px-1 font-mono text-[9px] text-ink-muted">
                      {badge.tag}
                    </span>
                  )}
                  {/* Voyant d'arbitrage (P1) : juge adopté sur cette clause. */}
                  {anchor?.resolvedFrom && (
                    <span
                      data-testid={`resolved-${s.index}`}
                      data-judge={anchor.resolvedFrom}
                      className="rounded border border-emerald-400/50 bg-emerald-400/10 px-1 text-[9px] font-semibold text-emerald-300"
                    >
                      ✓ {anchor.resolvedFrom === "claude" ? "Claude" : "Codex"}
                    </span>
                  )}
                </div>
              )}
              {/* Frontière LLM (P5) : marqueur discret + aperçu evidence/rationale.
                  Indépendant du badge humain car les frontières des juges ne
                  coïncident pas toujours avec les clauses humaines. */}
              {llmFrontier && (
                <div
                  data-testid={`llm-frontier-${s.index}`}
                  className="-mb-0.5 mt-2 flex items-center gap-1 pl-2 text-[10px] text-ink-muted"
                >
                  <span aria-hidden className="text-ink-muted/70">⊢ frontière LLM</span>
                  <button
                    type="button"
                    data-testid={`boundary-peek-${s.index}`}
                    aria-label={`Aperçu des preuves LLM à la frontière ${s.index}`}
                    title="Aperçu evidence/rationale — e"
                    onClick={(e) => openBoundaryAt(s.index, e.clientX, e.clientY)}
                    className="rounded px-1 text-[11px] hover:bg-panel-muted"
                  >
                    👁
                  </button>
                </div>
              )}
              <SentenceRow
                sentence={s}
                isFocused={isFocused}
                isSelected={isSelected}
                hasAnchor={Boolean(anchor)}
                compareState={isCompare ? (compareAgree ? "agree" : bothPresent ? "disagree" : null) : null}
                ghost={ghost}
                mark={mark}
                runColor={runColor}
                showDashedTop={showDashedTop}
                isRunStart={isRunStart}
                renderFr={renderFr}
                frText={frText}
                missingFr={missingFr}
                focusedRef={isFocused ? focusedRef : undefined}
                onBlockPointerDown={(e) => blockDrag.onSentencePointerDown(e, s.index)}
                shouldSuppressContextMenu={blockDrag.shouldSuppressContextMenu}
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
                  // Q2 : clic SIMPLE = focus + sélection mono, JAMAIS de création de
                  // clause. Si la phrase a une clause humaine, on la sélectionne pour
                  // l'inspecteur ; sinon l'inspecteur proposera de choisir un thème.
                  focusSentence(s.index);
                  if (anchor) selectClause(anchor.localId);
                  else selectClause(null);
                }}
                onKeyActivate={() => {
                  // Enter/Espace : même sémantique que le clic simple (Q2).
                  focusSentence(s.index);
                  if (anchor) selectClause(anchor.localId);
                  else selectClause(null);
                }}
                onOpenMenu={(x, y) => setMenu({ index: s.index, x, y })}
              />
              {/* Ligne FR sous l'original (P5/P9) — uniquement en mode orig/both. */}
              {perSentenceFr && (
                <p
                  data-testid={`translation-${s.index}`}
                  className="mb-1 ml-6 mt-0.5 flex items-start gap-1 italic text-ink-muted"
                >
                  <span className="flex-1">{frText}</span>
                  <button
                    type="button"
                    data-testid={`hide-translation-${s.index}`}
                    aria-label={`Masquer la traduction de la phrase ${s.index}`}
                    onClick={() => setTranslated(s.index, false)}
                    className="not-italic rounded px-1 text-ink-muted hover:bg-panel-muted"
                  >
                    ×
                  </button>
                </p>
              )}
            </div>
          );
        })}
       </div>

       {/* P4 : panneau comparatif sticky, dans le flux de la colonne centrale. */}
       {showComparePanel && compareDataReady && (
         <div className="sticky top-4 hidden h-[calc(100vh-9rem)] self-start xl:block">
           <ComparePanel
             claudeRuns={claudeRuns}
             codexRuns={codexRuns}
             claudeByIndex={llm.claudeByIndex}
             codexByIndex={llm.codexByIndex}
             n={n}
             focused={focused}
             onJump={(i) => focusSentence(i)}
             onClose={toggleComparePanel}
           />
         </div>
       )}
      </div>

      {/* Tooltip flottant suivant le curseur pendant la sélection multi-blocs (P8). */}
      {blockDrag.tip && (
        <div
          data-testid="block-select-tip"
          role="status"
          className="pointer-events-none fixed z-50 rounded-md border border-line bg-elevated px-2 py-1 text-xs text-ink shadow-lg"
          style={{ left: blockDrag.tip.x + 12, top: blockDrag.tip.y + 12 }}
        >
          {blockDrag.tip.count} bloc{blockDrag.tip.count > 1 ? "s" : ""} sélectionné
          {blockDrag.tip.count > 1 ? "s" : ""}
        </div>
      )}

      {menu && (
        <SentenceMenu
          sentenceIndex={menu.index}
          x={menu.x}
          y={menu.y}
          runs={humanRuns}
          claudeDetail={detailAt(claudeDetailByAnchor, claudeRuns, menu.index)}
          codexDetail={detailAt(codexDetailByAnchor, codexRuns, menu.index)}
          onClose={() => setMenu(null)}
        />
      )}
      {boundaryPop && (
        <BoundaryEvidence
          x={boundaryPop.x}
          y={boundaryPop.y}
          claudeDetail={boundaryClaude}
          codexDetail={boundaryCodex}
          onClose={() => setBoundaryPop(null)}
        />
      )}
      <SelectionToolbar />
    </>
  );
}

// ── Helpers (purs, hors composant pour éviter les re-créations) ───────────────

/** Ancres {anchorIndex, theme, localId} d'un juge à partir de ses PreClause. */
function judgeAnchors(clauses: PreClause[] | undefined) {
  return (clauses ?? []).map((c, i) => ({
    anchorIndex: c.anchorIndex,
    theme: c.themeCode,
    localId: `j-${i}`,
  }));
}

/** Map ancre → détail (thème/rationale/evidence) d'un juge, pour le menu phrase. */
function buildJudgeDetailMap(clauses: PreClause[] | undefined): Map<number, JudgeDetail> {
  const map = new Map<number, JudgeDetail>();
  for (const c of clauses ?? []) {
    map.set(c.anchorIndex, {
      anchorIndex: c.anchorIndex,
      theme: c.themeCode,
      rationale: c.rationale ?? null,
      evidence: c.evidenceSpan ?? null,
    });
  }
  return map;
}

/**
 * Détail du juge couvrant `index` : on remonte au début du run du juge (l'ancre)
 * pour récupérer le thème + rationale + evidence portés par cette clause. L'ancre
 * (run.start) sert de point d'application à l'arbitrage (resolveDivergence).
 */
function detailAt(
  detailByAnchor: Map<number, JudgeDetail>,
  judgeRuns: Run[],
  index: number,
): JudgeDetail | null {
  const run = runAt(judgeRuns, index);
  if (!run || run.theme == null) return null;
  return (
    detailByAnchor.get(run.start) ?? {
      anchorIndex: run.start,
      theme: run.theme,
      rationale: null,
      evidence: null,
    }
  );
}

interface Badge {
  label: string;
  color: string;
  tag?: string;
}

/**
 * Calcule l'en-tête de clause/puce à afficher au-dessus d'une phrase, selon la
 * source active (Q3). Renvoie null si rien à afficher pour cette phrase.
 */
function computeBadge(args: {
  llmSource: string;
  anchor: { theme: string; seededFrom?: string | null } | null;
  run: Run | undefined;
  isRunStart: boolean;
  claudeTheme: string | null;
  codexTheme: string | null;
  compareAgree: boolean;
  bothPresent: boolean;
}): Badge | null {
  const { llmSource, anchor, run, isRunStart, claudeTheme, codexTheme, compareAgree, bothPresent } =
    args;

  if (llmSource === "human") {
    if (!anchor) return null;
    return {
      label: getThemeToken(anchor.theme).label,
      color: getThemeToken(anchor.theme).color,
      tag: anchor.seededFrom ?? undefined,
    };
  }

  if (llmSource === "claude" || llmSource === "codex") {
    // Puce au début de chaque run du juge.
    if (!run || run.theme == null || !isRunStart) return null;
    return {
      label: getThemeToken(run.theme).label,
      color: getThemeToken(run.theme).color,
      tag: llmSource,
    };
  }

  // compare : puce uniquement aux phrases où au moins un juge propose un thème ET
  // où il s'agit d'un début de divergence/accord notable (début de run de Claude).
  if (llmSource === "compare") {
    if (!run || run.theme == null || !isRunStart) return null;
    if (compareAgree) {
      return { label: getThemeToken(run.theme).label, color: "#34D399", tag: "accord" };
    }
    const cl = claudeTheme ? getThemeToken(claudeTheme).label : "—";
    const cx = codexTheme ? getThemeToken(codexTheme).label : "—";
    return {
      label: bothPresent ? `${cl} ≠ ${cx}` : cl !== "—" ? cl : cx,
      color: "#FBBF24",
      tag: "divergence",
    };
  }

  return null;
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
  compareState,
  ghost,
  mark,
  runColor,
  showDashedTop,
  isRunStart,
  renderFr,
  frText,
  missingFr,
  focusedRef,
  onActivate,
  onKeyActivate,
  onOpenMenu,
  onBlockPointerDown,
  shouldSuppressContextMenu,
}: {
  sentence: Sentence;
  isFocused: boolean;
  isSelected: boolean;
  hasAnchor: boolean;
  /** En mode comparaison : accord ('agree')/divergence ('disagree') de la phrase. */
  compareState: "agree" | "disagree" | null;
  ghost: { judge: string; theme: string } | undefined;
  mark: UnfairnessMark | undefined;
  runColor: string | undefined;
  showDashedTop: boolean;
  isRunStart: boolean;
  /** Mode FR : afficher le texte traduit (repli VO si absent). */
  renderFr: boolean;
  frText: string | undefined;
  /** Mode FR sans traduction disponible → indicateur « VO ». */
  missingFr: boolean;
  focusedRef: React.RefObject<HTMLDivElement> | undefined;
  onActivate: (e: React.MouseEvent) => void;
  onKeyActivate: () => void;
  onOpenMenu: (x: number, y: number) => void;
  onBlockPointerDown: (e: React.PointerEvent) => void;
  shouldSuppressContextMenu: () => boolean;
}) {
  const longPress = useLongPress((x, y) => onOpenMenu(x, y));
  // Texte affiché : FR en mode `fr` (repli VO), sinon VO. L'index de phrase
  // reste l'unité d'interaction quel que soit le texte rendu.
  const displayText = renderFr && frText != null ? frText : s.rawText;

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
      data-compare={compareState ?? undefined}
      {...longPress}
      onPointerDown={(e) => {
        // Bouton droit : démarre une sélection de blocs (P8) PUIS délègue au long-press
        // (qui ignore les boutons != 0, donc pas de conflit avec le clic simple).
        onBlockPointerDown(e);
        longPress.onPointerDown(e);
      }}
      onContextMenu={(e) => {
        // Un drag de blocs vient d'avoir lieu → on annule l'ouverture du menu.
        if (shouldSuppressContextMenu()) {
          e.preventDefault();
          return;
        }
        longPress.onContextMenu(e);
      }}
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
          {displayText}
        </span>
      ) : (
        <span>{displayText}</span>
      )}
      {missingFr && (
        <span
          aria-hidden
          title="Traduction absente — texte original affiché"
          className="ml-2 rounded bg-panel-muted px-1 font-mono text-[9px] text-ink-muted"
        >
          VO
        </span>
      )}
      {ghost && !hasAnchor && (
        <span className="ml-2 rounded bg-panel-muted px-1 font-mono text-[9px] text-ink-muted">
          fantôme {ghost.judge}:{ghost.theme}
        </span>
      )}
    </div>
  );
}
