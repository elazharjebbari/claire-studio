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
import {
  computeRuns,
  coalesceRuns,
  runAt,
  runThemeAt,
  segmentsFromRuns,
  nextBoundaryFrom,
  conflictZones,
  type Run,
} from "@/lib/runs";
import { deriveBlocks, blockAt } from "@/lib/blocks";
import { ModelBoundaryStrip, ModelBoundaryLegend, type GutterModel } from "./ModelBoundaryRail";
import { LLM_JUDGES, llmJudgeLabel } from "@/lib/llmJudges";
import { validationByIndex } from "@/lib/validation";
import { useUiStore } from "@/store/ui";
import {
  useAnnotationVersions,
  useAttribution,
  useDocumentTranslations,
  useLlmAgreement,
  useMe,
} from "@/lib/api/hooks";
import { cn } from "@/lib/cn";
import { unfairnessStyle, useUnfairnessIndex, type UnfairnessMark } from "./useUnfairness";
import { useLongPress } from "./useLongPress";
import { useBlockDragSelect } from "./useBlockDragSelect";
import { SentenceMenu, type JudgeDetail } from "./SentenceMenu";
import { SelectionToolbar } from "./SelectionToolbar";
import { LangSwitch } from "./LangSwitch";
import { LlmSourceSwitch } from "./LlmSourceSwitch";
import { Eye, Users, Columns2, Ghost, TextSelect } from "lucide-react";
import { CollabBar } from "./CollabBar";
import { DivergenceNav } from "./DivergenceNav";
import { ComparePanel } from "./ComparePanel";
import { BoundaryEvidence } from "./BoundaryEvidence";
import { useDivergenceShortcuts } from "./useDivergenceShortcuts";
import {
  divergenceOrdinal,
  nextDivergence,
  prevDivergence,
} from "@/lib/divergence";

// Référence stable pour les juges sans pré-annotation (évite de casser les mémos).
const EMPTY_RUNS: Run[] = [];

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
  const resolveDivergenceRange = useWorkspaceStore((s) => s.resolveDivergenceRange);
  const showComparePanel = useWorkspaceStore((s) => s.showComparePanel);
  const toggleComparePanel = useWorkspaceStore((s) => s.toggleComparePanel);
  const showAttribution = useWorkspaceStore((s) => s.showAttribution);
  const toggleAttribution = useWorkspaceStore((s) => s.toggleAttribution);
  const annotationId = useWorkspaceStore((s) => s.annotationId);
  const showUnfairness = useWorkspaceStore((s) => s.showUnfairness);
  const ghostJudges = useWorkspaceStore((s) => s.ghostJudges);
  const ghosts = useWorkspaceStore((s) => s.ghostClauses);
  const nSentences = useWorkspaceStore((s) => s.nSentences);
  const llmSource = useWorkspaceStore((s) => s.llmSource);

  const showBoundaries = useWorkspaceStore((s) => s.showBoundaries);
  const toggleBoundaries = useWorkspaceStore((s) => s.toggleBoundaries);
  // Réglette frontières-modèles (Feature A) — préférences persistées (store UI).
  const gutterShowCategory = useUiStore((s) => s.gutterShowCategory);
  const gutterVisibility = useUiStore((s) => s.gutterModels);
  // Confort de lecture (point f) : zoom du texte + lignes élargies, persistés.
  const readingZoom = useUiStore((s) => s.readingZoom);
  const readingWide = useUiStore((s) => s.readingWide);
  const setReadingZoom = useUiStore((s) => s.setReadingZoom);
  const toggleReadingWide = useUiStore((s) => s.toggleReadingWide);
  const selectedSentences = useWorkspaceStore((s) => s.selectedSentences);
  const selectRange = useWorkspaceStore((s) => s.selectRange);
  const toggleSelected = useWorkspaceStore((s) => s.toggleSelected);
  const setSelectedClauses = useWorkspaceStore((s) => s.setSelectedClauses);
  const clearClauseSelection = useWorkspaceStore((s) => s.clearClauseSelection);
  const clearSelection = useWorkspaceStore((s) => s.clearSelection);
  const displayLang = useWorkspaceStore((s) => s.displayLang);
  const translatedSentences = useWorkspaceStore((s) => s.translatedSentences);
  const setTranslated = useWorkspaceStore((s) => s.setTranslated);

  const n = nSentences || sentences.length;

  const llmVersion = useWorkspaceStore((s) => s.llmVersion);
  const setLlmVersion = useWorkspaceStore((s) => s.setLlmVersion);
  // Versions LLM disponibles pour ce document (multi-versions).
  const versionsQuery = useAnnotationVersions(documentId);
  const availableVersions = versionsQuery.data?.versions ?? [];
  // Identité de l'annotateur courant (badge de provenance « moi », point c).
  const me = useMe();
  const myName = me.data?.displayName || me.data?.username || "moi";

  // Accord LLM (Q3) — projection par phrase + score + détails par juge, pour la version choisie.
  const llm = useLlmAgreement(documentId, projectSlug, llmVersion);

  // Détails (rationale/evidence) par juge, indexés par ancre → menu phrase enrichi.
  // N-modèles : une map par juge configuré (source unique LLM_JUDGES).
  const detailMapByJudge = useMemo<Record<string, Map<number, JudgeDetail>>>(() => {
    const map: Record<string, Map<number, JudgeDetail>> = {};
    for (const j of LLM_JUDGES) {
      map[j.id] = buildJudgeDetailMap(llm.preByJudge[j.id]?.clauses);
    }
    return map;
  }, [llm.preByJudge]);
  const EMPTY_DETAIL = useMemo(() => new Map<number, JudgeDetail>(), []);
  const claudeDetailByAnchor = detailMapByJudge.claude ?? EMPTY_DETAIL;
  const codexDetailByAnchor = detailMapByJudge.codex ?? EMPTY_DETAIL;

  // Attribution multi-annotateurs (point 3) — dernière modif par ancre de clause.
  const attribution = useAttribution(showAttribution ? annotationId ?? undefined : undefined, "clause");
  const attributionByAnchor = useMemo(() => {
    const m = new Map<number, { actorName: string; actorColor: string; verb: string }>();
    for (const e of attribution.data?.results ?? [])
      m.set(e.index, { actorName: e.actorName, actorColor: e.actorColor, verb: e.verb });
    return m;
  }, [attribution.data]);

  const unfairIndex = useUnfairnessIndex(referenceLabels);
  const anchorByIndex = useMemo(
    () => new Map(drafts.map((d) => [d.anchorIndex, d])),
    [drafts],
  );
  // Point d — statut de validation par phrase (validated / pending / uncovered) pour la
  // piste de validation à gauche de chaque ligne.
  const validationStatuses = useMemo(() => validationByIndex(drafts, n), [drafts, n]);
  // D5 — regroupement PAR INDEX (tableau) : si Claude ET Codex proposent une frontière
  // à la même phrase, on les conserve TOUS (l'ancienne Map clée par index n'en gardait
  // qu'un, le dernier). Chaque juge visible est rendu comme un badge distinct.
  const ghostByIndex = useMemo(() => {
    const m = new Map<number, Array<{ judge: string; theme: string }>>();
    for (const g of ghosts) {
      if (ghostJudges[g.judge] !== true) continue;
      const arr = m.get(g.anchorIndex) ?? [];
      arr.push({ judge: g.judge, theme: g.theme });
      m.set(g.anchorIndex, arr);
    }
    return m;
  }, [ghosts, ghostJudges]);

  // Runs de la source ACTIVE (Q3). En `human` → clauses humaines ; en `claude`/`codex`
  // → segmentation du juge ; en `compare` → on s'appuie sur la projection par phrase.
  // Annotation HUMAINE par phrase (C4) : une clause ne colore QUE sa phrase, pas un
  // span. Les juges LLM (ci-dessous) gardent le forward-fill (segments).
  const humanRuns = useMemo(
    () => computeRuns(drafts.map((d) => ({ ...d })), n, { perSentence: true }),
    [drafts, n],
  );
  // Blocs dérivés (Feature B) : suites contiguës de même thème, pour la sélection
  // de bloc au double-clic (S7). Pure et mémoïsée (B-PERF-1).
  const blocks = useMemo(() => deriveBlocks(humanRuns), [humanRuns]);
  // N-modèles : runs (forward-fill) par juge configuré, dérivés de ses pré-annotations.
  // Source unique pour la réglette, la source de rendu (switch) et le panneau Comparer.
  // Ajouter un modèle = une entrée dans LLM_JUDGES (+ backend/import).
  const runsByJudge = useMemo<Record<string, Run[]>>(() => {
    const map: Record<string, Run[]> = {};
    for (const j of LLM_JUDGES) {
      // coalesceRuns : fusionne les segments adjacents de même thème → une seule
      // frontière par changement de thème (corrige le découpage très fin, ex. Mistral).
      map[j.id] = coalesceRuns(computeRuns(judgeAnchors(llm.preByJudge[j.id]?.clauses), n));
    }
    return map;
  }, [llm.preByJudge, n]);
  const claudeRuns = runsByJudge.claude ?? EMPTY_RUNS;
  const codexRuns = runsByJudge.codex ?? EMPTY_RUNS;
  // Pistes de la réglette (Feature A) : dérivées des runs LLM (forward-fill).
  // identityColor = couleur d'IDENTITÉ (≠ catégorie). Une piste par juge configuré.
  const gutterAllModels = useMemo<GutterModel[]>(
    () =>
      LLM_JUDGES.map((j) => ({
        id: j.id,
        label: j.label,
        initial: j.initial,
        segments: segmentsFromRuns(runsByJudge[j.id] ?? EMPTY_RUNS),
        hasData: !!llm.preByJudge[j.id]?.clauses?.length,
        identityColor: j.identityColor,
      })),
    [runsByJudge, llm.preByJudge],
  );
  const gutterVisibleModels = useMemo(
    () => gutterAllModels.filter((m) => m.hasData && gutterVisibility[m.id] !== false),
    [gutterAllModels, gutterVisibility],
  );
  // D3 — frontières « tous modèles confondus » : débuts de blocs HUMAINS + débuts de
  // segments des modèles LLM VISIBLES. Sert à sélectionner jusqu'à la frontière suivante.
  const boundaryStarts = useMemo(() => {
    const set = new Set<number>();
    for (const b of blocks) set.add(b.start);
    for (const m of gutterVisibleModels) for (const seg of m.segments) set.add(seg.startSentence);
    return Array.from(set);
  }, [blocks, gutterVisibleModels]);
  // D6c — zones de conflit (modèles visibles divergents) → index de 1re phrase par phrase.
  const conflictStartByIndex = useMemo(() => {
    const m = new Map<number, number>();
    for (const z of conflictZones(gutterVisibleModels, n)) {
      for (let i = z.start; i <= z.end; i += 1) m.set(i, z.start);
    }
    return m;
  }, [gutterVisibleModels, n]);
  // Source de rendu : humain/comparer → runs humains ; sinon runs du juge sélectionné
  // (Claude/Codex/Mistral…), avec repli sur l'humain si le juge n'a pas de données.
  const runs =
    llmSource === "human" || llmSource === "compare"
      ? humanRuns
      : runsByJudge[llmSource] ?? humanRuns;
  const isCompare = llmSource === "compare";

  // Comparaison N-way : thème par phrase (forward-fill) pour CHAQUE juge, dérivé de ses
  // runs. La SÉLECTION suit la réglette « Modèles » (gutterVisibility) : masquer un
  // modèle le retire de la comparaison ET de la divergence. Source unique.
  const byIndexByJudge = useMemo<Record<string, (string | null)[]>>(() => {
    const map: Record<string, (string | null)[]> = {};
    for (const j of LLM_JUDGES) {
      const r = runsByJudge[j.id] ?? EMPTY_RUNS;
      map[j.id] = Array.from({ length: n }, (_, i) => runThemeAt(r, i));
    }
    return map;
  }, [runsByJudge, n]);
  const availableCompareJudges = useMemo(
    () => LLM_JUDGES.filter((j) => !!llm.preByJudge[j.id]?.clauses?.length),
    [llm.preByJudge],
  );
  const selectedCompareIds = useMemo(
    () =>
      availableCompareJudges
        .filter((j) => gutterVisibility[j.id] !== false)
        .map((j) => j.id),
    [availableCompareJudges, gutterVisibility],
  );
  const compareJudgesData = useMemo(
    () =>
      selectedCompareIds.map((id) => ({
        id,
        label: llmJudgeLabel(id),
        runs: runsByJudge[id] ?? EMPTY_RUNS,
        byIndex: byIndexByJudge[id] ?? [],
      })),
    [selectedCompareIds, runsByJudge, byIndexByJudge],
  );
  // Le panneau comparatif n'a de sens que si ≥ 2 juges sont disponibles avec données.
  const compareDataReady = availableCompareJudges.length >= 2;

  // Divergences N-way (P1) : ancres des zones où les modèles SÉLECTIONNÉS divergent
  // (≥ 2 thèmes distincts), pas seulement Claude vs Codex.
  const divAnchors = useMemo(
    () =>
      conflictZones(
        compareJudgesData.map((j) => ({ segments: segmentsFromRuns(j.runs) })),
        n,
      ).map((z) => z.start),
    [compareJudgesData, n],
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
  // Adoption au clavier (1/2) de la proposition du juge couvrant la phrase focalisée :
  // sur TOUT le segment du juge (toute la frontière), pas seulement l'ancre.
  const adoptAtFocus = (judge: "claude" | "codex") => {
    const detail =
      judge === "claude"
        ? detailAt(claudeDetailByAnchor, claudeRuns, focused)
        : detailAt(codexDetailByAnchor, codexRuns, focused);
    if (detail) resolveDivergenceRange(detail.anchorIndex, detail.endIndex, judge, detail.theme);
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
       <div
        className={
          "w-full font-reading leading-reading text-ink " +
          (readingWide ? "max-w-none" : "max-w-reading")
        }
        style={{ fontSize: `${Math.round(17 * readingZoom)}px` }}
       >
        <div
          data-testid="document-controls"
          className="sticky top-0 z-20 -mx-2 mb-4 flex flex-wrap items-center gap-3 border-b border-line/40 bg-reading/90 px-2 py-2 text-sm backdrop-blur supports-[backdrop-filter]:bg-reading/75"
        >
          <CollabBar projectSlug={projectSlug} />
          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
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
          <button
            type="button"
            data-testid="toggle-attribution"
            aria-pressed={showAttribution}
            onClick={toggleAttribution}
            title="Attribution : qui a modifié quoi"
            className={
              "rounded-md border px-2 py-1 transition-colors " +
              (showAttribution
                ? "border-accent/60 bg-accent/10 text-ink"
                : "border-line text-ink-muted hover:bg-panel-muted")
            }
          >
            <span className="inline-flex items-center gap-1.5"><Users size={14} aria-hidden /> Attribution</span>
          </button>
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
              <span className="inline-flex items-center gap-1.5"><Columns2 size={14} aria-hidden /> Comparer</span>
            </button>
          )}
          <button
            type="button"
            data-testid="select-to-boundary"
            onClick={() => selectRange(focused, nextBoundaryFrom(boundaryStarts, focused, n) - 1)}
            title="Sélectionner de la phrase courante jusqu'à la frontière suivante (tous modèles confondus)"
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-ink-muted hover:bg-panel-muted hover:text-ink"
          >
            <TextSelect size={14} aria-hidden /> Jusqu'à la frontière
          </button>
          {gutterAllModels.some((m) => m.hasData) && (
            <ModelBoundaryLegend models={gutterAllModels} />
          )}
          {/* Confort de lecture (point f) : zoom du texte + lignes élargies. */}
          <div
            data-testid="reading-controls"
            className="inline-flex items-center gap-1 rounded-md border border-line p-0.5 text-ink-muted"
            role="group"
            aria-label="Confort de lecture"
          >
            <button
              type="button"
              data-testid="reading-zoom-out"
              aria-label="Réduire le texte"
              title="Réduire le texte"
              onClick={() => setReadingZoom(Math.round((readingZoom - 0.1) * 10) / 10)}
              className="rounded px-1.5 py-0.5 text-xs hover:bg-panel-muted"
            >
              A−
            </button>
            <span className="min-w-[2.5rem] text-center font-mono text-[10px]" data-testid="reading-zoom-value">
              {Math.round(readingZoom * 100)}%
            </span>
            <button
              type="button"
              data-testid="reading-zoom-in"
              aria-label="Agrandir le texte"
              title="Agrandir le texte"
              onClick={() => setReadingZoom(Math.round((readingZoom + 0.1) * 10) / 10)}
              className="rounded px-1.5 py-0.5 text-xs hover:bg-panel-muted"
            >
              A+
            </button>
            <button
              type="button"
              data-testid="reading-wide"
              aria-pressed={readingWide}
              title="Élargir les lignes (utilise l'espace libéré)"
              onClick={toggleReadingWide}
              className={
                "rounded px-1.5 py-0.5 text-xs transition-colors " +
                (readingWide ? "bg-accent/15 text-ink ring-1 ring-accent/40" : "hover:bg-panel-muted")
              }
            >
              ↔
            </button>
          </div>
          <LangSwitch />
          </div>
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
          const ghostList = ghostByIndex.get(s.index);
          const mark: UnfairnessMark | undefined = showUnfairness
            ? unfairIndex.get(s.index)
            : undefined;

          // Comparaison N-way par phrase : thèmes des modèles SÉLECTIONNÉS (réglette).
          const cmpThemes = selectedCompareIds
            .map((id) => byIndexByJudge[id]?.[s.index] ?? null)
            .filter((t): t is string => t != null);
          const compareDistinct = Array.from(new Set(cmpThemes));
          const comparePresent = cmpThemes.length;
          const compareAgree = comparePresent >= 2 && compareDistinct.length === 1;
          const compareDisagree = compareDistinct.length >= 2;

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
              comparePresent === 0
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
            compareDistinct,
            comparePresent,
            compareAgree,
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

          const vStatus = validationStatuses[s.index] ?? "uncovered";
          return (
            <div
              key={s.id}
              data-sentence-index={s.index}
              className={
                "group relative pl-5" +
                (showBoundaries && gutterVisibleModels.length > 0 ? " pr-10" : "")
              }
              onDoubleClick={() => {
                // S7 — double-clic : sélectionne le BLOC contigu de même thème (mode
                // bloc) ; sur une phrase neutre, on efface la sélection (S8).
                const b = blockAt(blocks, s.index);
                if (b) setSelectedClauses(b.localIds);
                else {
                  clearSelection();
                  clearClauseSelection();
                }
              }}
            >
              {/* Point d — piste de validation (bord gauche) : vert = validé, ambre =
                  annoté non validé, gris = non couvert. Cliquable → focus la phrase. */}
              <button
                type="button"
                data-testid={`validation-track-${s.index}`}
                data-status={vStatus}
                onClick={() => focusSentence(s.index)}
                title={
                  vStatus === "validated"
                    ? "Validé"
                    : vStatus === "pending"
                      ? "Annoté — à valider"
                      : "Non annoté"
                }
                aria-label={`Phrase ${s.index} — ${
                  vStatus === "validated" ? "validée" : vStatus === "pending" ? "à valider" : "non annotée"
                }`}
                className="absolute bottom-1 left-1 top-1 w-1 cursor-pointer rounded-full transition-colors"
                style={{
                  backgroundColor:
                    vStatus === "validated"
                      ? "#34D399"
                      : vStatus === "pending"
                        ? "#FBBF24"
                        : "rgb(var(--surface-border))",
                  opacity: vStatus === "uncovered" ? 0.35 : 0.85,
                }}
              />
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
                  {/* Attribution (point 3) : dernier annotateur ayant touché cette clause. */}
                  {showAttribution && anchor && attributionByAnchor.has(anchor.anchorIndex) && (
                    <span
                      data-testid={`attribution-${s.index}`}
                      title={`${attributionByAnchor.get(anchor.anchorIndex)!.actorName} · ${attributionByAnchor.get(anchor.anchorIndex)!.verb}`}
                      className="inline-flex items-center gap-1 rounded px-1 text-[9px] font-medium text-ink-muted"
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: attributionByAnchor.get(anchor.anchorIndex)!.actorColor }}
                      />
                      {attributionByAnchor.get(anchor.anchorIndex)!.actorName}
                    </span>
                  )}
                  {/* Provenance par phrase (point c) — une seule pastille, par priorité :
                      1. juge ADOPTÉ (resolvedFrom) → « ✓ {Juge} » (vert)
                      2. PRÉ-REMPLI non encore arbitré (seededFrom) → « ◷ {Juge} » (ambre,
                         aide seulement, pas la référence)
                      3. annotation HUMAINE → « ✎ moi » (ardoise).
                      Généralisé à Mistral via llmJudgeLabel. */}
                  {anchor &&
                    (anchor.resolvedFrom ? (
                      <span
                        data-testid={`resolved-${s.index}`}
                        data-judge={anchor.resolvedFrom}
                        className="rounded border border-emerald-400/50 bg-emerald-400/10 px-1 text-[9px] font-semibold text-emerald-300"
                      >
                        ✓ {llmJudgeLabel(anchor.resolvedFrom)}
                      </span>
                    ) : anchor.seededFrom ? (
                      <span
                        data-testid={`seeded-${s.index}`}
                        data-judge={anchor.seededFrom.replace(/^preannotation:/, "")}
                        title="Pré-rempli — à valider (n'est pas la référence)"
                        className="rounded border border-amber-400/40 bg-amber-400/10 px-1 text-[9px] font-semibold text-amber-300"
                      >
                        ◷ {llmJudgeLabel(anchor.seededFrom.replace(/^preannotation:/, ""))}
                      </span>
                    ) : (
                      <span
                        data-testid={`author-${s.index}`}
                        data-author={myName}
                        title={`Annoté par ${myName}`}
                        className="rounded border border-slate-400/40 bg-slate-400/10 px-1 text-[9px] font-semibold text-slate-300"
                      >
                        ✎ moi
                      </span>
                    ))}
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
                  <span aria-hidden className="text-ink-muted">frontière LLM</span>
                  <button
                    type="button"
                    data-testid={`boundary-peek-${s.index}`}
                    aria-label={`Aperçu des preuves LLM à la frontière ${s.index}`}
                    title="Aperçu evidence/rationale — e"
                    onClick={(e) => openBoundaryAt(s.index, e.clientX, e.clientY)}
                    className="inline-flex items-center rounded px-1 text-ink-muted hover:bg-panel-muted"
                  >
                    <Eye size={13} aria-hidden />
                  </button>
                </div>
              )}
              <SentenceRow
                sentence={s}
                isFocused={isFocused}
                isSelected={isSelected}
                hasAnchor={Boolean(anchor)}
                compareState={isCompare ? (compareAgree ? "agree" : compareDisagree ? "disagree" : null) : null}
                ghosts={ghostList}
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
                  // clause. D2 — il RÉINITIALISE d'abord la multi-sélection (phrases +
                  // blocs) pour que Cmd/Ctrl+clic et Maj+clic repartent d'un état propre.
                  clearSelection();
                  clearClauseSelection();
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
              {/* Réglette frontières-modèles (Feature A) : bande alignée à la ligne. */}
              {showBoundaries && gutterVisibleModels.length > 0 && (
                <ModelBoundaryStrip
                  sentenceIndex={s.index}
                  models={gutterVisibleModels}
                  showCategory={gutterShowCategory}
                  onJump={focusSentence}
                  conflictStart={conflictStartByIndex.get(s.index)}
                />
              )}
            </div>
          );
        })}
       </div>

       {/* P4 : panneau comparatif sticky, dans le flux de la colonne centrale. */}
       {showComparePanel && compareDataReady && (
         <div className="sticky top-4 hidden h-[calc(100vh-9rem)] self-start xl:block">
           <ComparePanel
             judges={compareJudgesData}
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
          judges={LLM_JUDGES.map((j) => ({
            id: j.id,
            label: j.label,
            detail: detailAt(
              detailMapByJudge[j.id] ?? EMPTY_DETAIL,
              runsByJudge[j.id] ?? EMPTY_RUNS,
              menu.index,
            ),
          }))}
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
      // endIndex réel recalculé dans detailAt depuis le run ; ancre par défaut ici.
      endIndex: c.anchorIndex,
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
  const base = detailByAnchor.get(run.start);
  // endIndex = fin du segment du juge (run.end) → adoption sur toute la frontière.
  return {
    anchorIndex: run.start,
    endIndex: run.end,
    theme: base?.theme ?? run.theme,
    rationale: base?.rationale ?? null,
    evidence: base?.evidence ?? null,
  };
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
  /** Thèmes DISTINCTS des modèles sélectionnés couvrant la phrase (compare N-way). */
  compareDistinct: string[];
  /** Nombre de modèles sélectionnés couvrant la phrase. */
  comparePresent: number;
  compareAgree: boolean;
}): Badge | null {
  const { llmSource, anchor, run, isRunStart, compareDistinct, comparePresent, compareAgree } =
    args;

  if (llmSource === "human") {
    if (!anchor) return null;
    return {
      label: getThemeToken(anchor.theme).label,
      color: getThemeToken(anchor.theme).color,
      tag: anchor.seededFrom ?? undefined,
    };
  }

  if (llmSource !== "compare") {
    // Juge LLM (claude/codex/mistral…) : puce au début de chaque run du juge.
    if (!run || run.theme == null || !isRunStart) return null;
    return {
      label: getThemeToken(run.theme).label,
      color: getThemeToken(run.theme).color,
      tag: llmSource,
    };
  }

  // compare : puce au début d'un run humain, reflétant l'accord/désaccord des modèles
  // SÉLECTIONNÉS (N-way : Claude/Codex/Mistral selon la réglette).
  if (llmSource === "compare") {
    if (!run || run.theme == null || !isRunStart) return null;
    if (compareDistinct.length === 0) return null;
    if (compareDistinct.length === 1) {
      const t = getThemeToken(compareDistinct[0]!);
      return {
        label: t.label,
        color: compareAgree ? "#34D399" : "#94A3B8",
        tag: compareAgree ? "accord" : "partiel",
      };
    }
    // ≥ 2 thèmes distincts parmi les modèles sélectionnés → divergence N-way.
    return {
      label: compareDistinct.map((c) => getThemeToken(c).label).join(" ≠ "),
      color: "#FBBF24",
      tag: `divergence (${comparePresent})`,
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
  ghosts,
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
  ghosts: Array<{ judge: string; theme: string }> | undefined;
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
        ghosts?.length && !hasAnchor ? "outline-dashed outline-1 outline-ink-muted/40" : "",
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
      {ghosts?.map((g) => (
        <span
          key={g.judge}
          data-testid={`ghost-${g.judge}-${s.index}`}
          title={`Frontière proposée par ${g.judge} (non retenue) : ${g.theme}`}
          className="ml-2 inline-flex items-center gap-1 rounded border border-dashed border-ink-muted/50 bg-panel-muted/60 px-1 font-mono text-[9px] text-ink-muted"
        >
          <Ghost size={10} aria-hidden /> {g.judge}:{g.theme}
        </span>
      ))}
    </div>
  );
}
