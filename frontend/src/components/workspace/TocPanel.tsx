"use client";

/**
 * Panneau gauche — Plan / TOC : clauses du document (thèmes colorés), progression,
 * sauts rapides, et toggles d'overlays (injustice, fantôme LLM). navigation.md §3.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleDashed, ArrowRight } from "lucide-react";
import { ClauseChip } from "@/components/ui/ClauseChip";
import { ThemePalette } from "@/components/ui/ThemePalette";
import { useWorkspaceStore } from "@/store/workspace";
import { LLM_JUDGES } from "@/lib/llmJudges";
import { secondaryCount } from "@/lib/validationDisplay";
import { uncoveredCount, nextUncovered } from "@/lib/planCoverage";

export function TocPanel({ docTitle }: { docTitle: string }) {
  const drafts = useWorkspaceStore((s) => s.draftClauses);
  const selectedId = useWorkspaceStore((s) => s.selectedClauseId);
  const selectClause = useWorkspaceStore((s) => s.selectClause);
  const focusSentence = useWorkspaceStore((s) => s.focusSentence);
  const focusedSentence = useWorkspaceStore((s) => s.focusedSentence);
  const nSentences = useWorkspaceStore((s) => s.nSentences);
  // Sélection MULTIPLE de clauses dans le plan (Cmd/Ctrl+clic) → annoter/valider en lot.
  const selectedClauseIds = useWorkspaceStore((s) => s.selectedClauseIds);
  const setSelectedClauses = useWorkspaceStore((s) => s.setSelectedClauses);
  const clearClauseSelection = useWorkspaceStore((s) => s.clearClauseSelection);
  const applyBlockOp = useWorkspaceStore((s) => s.applyBlockOp);
  const validateClauses = useWorkspaceStore((s) => s.validateClauses);
  const readOnly = useWorkspaceStore((s) => s.readOnly);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Synchro phrase → block : quand la clause sélectionnée change (ex. clic d'une phrase
  // dans la zone d'annotation), on DÉFILE le chip correspondant dans la vue de l'aside
  // (symétrique du scroll document au clic d'un chip) — sinon le chip surligné reste
  // hors écran sur un plan long. Sélection SIMPLE uniquement (pas la multi-sélection).
  useEffect(() => {
    if (!selectedId) return;
    const el = navRef.current?.querySelector<HTMLElement>(
      '[data-testid="clause-chip"][data-selected]',
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  // Fermeture du menu : clic EN DEHORS (check `contains`) ou Échap. Un blanket
  // `mousedown → close` fermait le menu sur le mousedown d'une tuile, la démontant
  // AVANT le click → onChange jamais appelé (la catégorie ne s'appliquait pas).
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  // Anchors des clauses sélectionnées, LU FRAIS depuis le store au moment de l'action
  // (évite toute fermeture sur état périmé du closure de rendu).
  function selectedAnchorsNow(): number[] {
    const ids = useWorkspaceStore.getState().selectedClauseIds;
    return useWorkspaceStore
      .getState()
      .draftClauses.filter((d) => ids.includes(d.localId))
      .map((d) => d.anchorIndex);
  }

  function onChipClick(e: React.MouseEvent, localId: string, anchorIndex: number) {
    if (e.metaKey || e.ctrlKey) {
      // Toggle multi-sélection (Cmd sur Mac / Ctrl ailleurs).
      const has = selectedClauseIds.includes(localId);
      setSelectedClauses(
        has ? selectedClauseIds.filter((id) => id !== localId) : [...selectedClauseIds, localId],
      );
      return;
    }
    selectClause(localId);
    focusSentence(anchorIndex);
    clearClauseSelection();
  }

  function onChipContext(e: React.MouseEvent, localId: string) {
    e.preventDefault();
    // S'assurer que la clause cliquée fait partie de la sélection avant d'ouvrir le menu.
    if (!selectedClauseIds.includes(localId)) {
      setSelectedClauses(selectedClauseIds.length > 0 ? [...selectedClauseIds, localId] : [localId]);
    }
    if (!readOnly) setMenu({ x: e.clientX, y: e.clientY });
  }

  function annotateSelection(theme: string) {
    const anchors = selectedAnchorsNow();
    if (anchors.length > 0) applyBlockOp({ kind: "annotateRange", anchors, theme });
    setMenu(null);
    clearClauseSelection();
  }

  const showUnfairness = useWorkspaceStore((s) => s.showUnfairness);
  const toggleUnfairness = useWorkspaceStore((s) => s.toggleUnfairness);
  const ghostJudges = useWorkspaceStore((s) => s.ghostJudges);
  const toggleGhost = useWorkspaceStore((s) => s.toggleGhost);
  // Overlay « Traduction (FR) » branché sur le mode de langue (P10) : coché = FR,
  // décoché = VO. Bascule cohérente avec le switch segmenté du DocumentPanel.
  const displayLang = useWorkspaceStore((s) => s.displayLang);
  const setDisplayLang = useWorkspaceStore((s) => s.setDisplayLang);
  const frActive = displayLang === "fr";

  const coverage = nSentences > 0 ? Math.round((drafts.length / nSentences) * 100) : 0;
  const validatedCount = drafts.filter((c) => c.validated).length;
  const validatedPct =
    nSentences > 0 ? Math.round((validatedCount / nSentences) * 100) : 0;

  // Correctif « blocks manquants » : les phrases NON annotées étaient invisibles dans le
  // plan (qui ne listait que les clauses). On affiche désormais UN BLOC PAR PHRASE en ordre
  // document — chip de clause si annotée, sinon bloc « à annoter » (placeholder) cliquable.
  // Le plan reflète ainsi TOUT le document (193 blocs ici), pas seulement les clauses.
  const anchorIndexes = useMemo(() => drafts.map((d) => d.anchorIndex), [drafts]);
  const remaining = uncoveredCount(anchorIndexes, nSentences);
  const draftByAnchor = useMemo(
    () => new Map(drafts.map((d) => [d.anchorIndex, d])),
    [drafts],
  );
  const sentenceIndexes = useMemo(
    () => Array.from({ length: Math.max(0, nSentences) }, (_, i) => i),
    [nSentences],
  );

  // « Aller à la prochaine phrase non annotée » : cycle les trous depuis la phrase
  // focalisée (le DocumentPanel défile vers `focused`). Désélectionne la clause courante.
  function goToNextUncovered() {
    const i = nextUncovered(anchorIndexes, nSentences, focusedSentence);
    if (i == null) return;
    focusSentence(i);
    selectClause(null);
    clearClauseSelection();
  }

  // Clic d'un bloc « à annoter » : focalise la phrase dans le document (scroll) pour
  // l'annoter sur place. Désélectionne toute clause.
  function focusEmptySentence(index: number) {
    focusSentence(index);
    selectClause(null);
    clearClauseSelection();
  }

  return (
    // Colonne pleine hauteur : en-tête + overlays figés (shrink-0), liste de clauses
    // défilante (flex-1) au milieu. Plus de grande zone vide sous le plan quand le
    // contenu est court (le `<nav>` s'étire), et liste défilable proprement quand il est
    // long — sans rogner l'en-tête ni les overlays (patron de l'inspecteur).
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="shrink-0">
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
        {/* Point d — progression de VALIDATION humaine (vert) : phrases validées / total. */}
        <div className="mt-1.5 flex items-center gap-2">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-muted"
            role="progressbar"
            aria-label={`Validation ${validatedPct}%`}
            aria-valuenow={validatedPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-emerald-400 transition-all"
              style={{ width: `${validatedPct}%` }}
              aria-hidden
            />
          </div>
          <span className="shrink-0 font-mono text-[10px] text-ink-muted" data-testid="toc-validated">
            ✓ {validatedCount}/{nSentences}
          </span>
        </div>

        {/* Couverture : phrases restant à annoter + saut direct (correctif « blocks
            manquants » — l'annotateur voit qu'il reste des phrases et y accède d'un clic). */}
        {remaining > 0 && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-ink-muted" data-testid="toc-coverage" aria-live="polite">
              <span className="font-mono text-ink">{drafts.length}/{nSentences}</span> annotées ·{" "}
              <span className="font-mono text-amber-300">{remaining}</span> restante{remaining > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              data-testid="toc-goto-gap"
              onClick={goToNextUncovered}
              title="Aller à la prochaine phrase non annotée"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-0.5 text-[11px] font-medium text-ink-muted transition-colors hover:bg-panel-muted hover:text-ink"
            >
              Prochaine non annotée <ArrowRight size={12} aria-hidden />
            </button>
          </div>
        )}
      </div>

      {selectedClauseIds.length > 0 && (
        <div
          data-testid="toc-selection-bar"
          className="flex shrink-0 items-center justify-between gap-2 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-[11px] text-ink"
        >
          <span>{selectedClauseIds.length} sélectionnée{selectedClauseIds.length > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="toc-validate-selection"
              onClick={() => {
                validateClauses(selectedClauseIds, true);
                clearClauseSelection();
              }}
              className="rounded border border-emerald-400/50 px-1.5 py-0.5 text-emerald-300 hover:bg-emerald-400/10"
            >
              ✓ Valider
            </button>
            <button
              type="button"
              data-testid="toc-selection-clear"
              onClick={clearClauseSelection}
              className="rounded border border-line px-1.5 py-0.5 text-ink-muted hover:bg-panel-muted"
            >
              Effacer
            </button>
          </div>
        </div>
      )}

      <nav
        ref={navRef}
        aria-label="Plan des clauses"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
      >
        {nSentences === 0 && (
          <p className="rounded-md border border-dashed border-line p-3 text-xs text-ink-muted">
            Aucune phrase à annoter dans ce document.
          </p>
        )}
        {/* Plan COMPLET en ordre document : UN BLOC PAR PHRASE — chip de clause si annotée,
            sinon bloc « à annoter » (placeholder) cliquable. Répond à « où sont le reste des
            blocks » : toutes les phrases du document ont leur bloc, pas un résumé. */}
        {sentenceIndexes.map((i) => {
          const c = draftByAnchor.get(i);
          if (c) {
            return (
              <ClauseChip
                key={c.localId}
                themeCode={c.theme}
                anchorIndex={c.anchorIndex}
                selected={selectedId === c.localId || selectedClauseIds.includes(c.localId)}
                ghost={Boolean(c.seededFrom) && !c.validated}
                validated={Boolean(c.validated)}
                seededFrom={c.seededFrom}
                resolvedFrom={c.resolvedFrom}
                triageLevel={c.triageLevel}
                secondaryCount={secondaryCount(c.themes)}
                onClick={(e) => onChipClick(e, c.localId, c.anchorIndex)}
                onContextMenu={(e) => onChipContext(e, c.localId)}
                className="w-full justify-start"
              />
            );
          }
          // Bloc « à annoter » : même gabarit que les chips, mais en pointillés/sourdine.
          return (
            <button
              key={`empty-${i}`}
              type="button"
              data-testid="plan-empty"
              data-index={i}
              onClick={() => focusEmptySentence(i)}
              title={`Phrase ${i} non annotée — cliquez pour l'annoter`}
              className="inline-flex w-full items-center justify-start gap-1.5 rounded-md border border-dashed border-line/70 bg-panel-muted/15 px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-accent/40 hover:bg-panel-muted hover:text-ink"
            >
              <CircleDashed size={12} aria-hidden className="shrink-0 opacity-70" />
              <span className="font-mono">[{i}]</span>
              <span className="min-w-0 truncate italic">à annoter</span>
            </button>
          );
        })}
      </nav>

      <fieldset data-testid="toc-overlays" className="shrink-0 rounded-md border border-line p-2">
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
        {LLM_JUDGES.map((j) => (
          <label
            key={j.id}
            className="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink"
          >
            <input
              type="checkbox"
              data-testid={`toggle-ghost-${j.id}`}
              checked={ghostJudges[j.id] === true}
              onChange={() => toggleGhost(j.id)}
            />
            Fantôme LLM · {j.label}
          </label>
        ))}
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

      {/* Menu contextuel (clic-droit) : annoter / valider TOUTE la sélection en lot. */}
      {menu && (
        <div
          ref={menuRef}
          role="menu"
          data-testid="toc-clause-menu"
          className="fixed z-50 w-72 rounded-lg border border-line bg-elevated p-3 text-sm shadow-xl"
          style={{ top: Math.min(menu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 360), left: Math.min(menu.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 300) }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-ink-muted">
              {selectedClauseIds.length} clause{selectedClauseIds.length > 1 ? "s" : ""} — annoter
            </span>
            <button
              type="button"
              onClick={() => setMenu(null)}
              aria-label="Fermer"
              className="rounded px-1 text-ink-muted hover:bg-panel-muted"
            >
              ✕
            </button>
          </div>
          <ThemePalette value={null} onChange={annotateSelection} autoFocus layout="grid" describeOnHover />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              data-testid="toc-menu-validate"
              onClick={() => {
                validateClauses(useWorkspaceStore.getState().selectedClauseIds, true);
                setMenu(null);
                clearClauseSelection();
              }}
              className="rounded-md border border-emerald-400/50 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-400/10"
            >
              ✓ Valider la sélection
            </button>
            <button
              type="button"
              data-testid="toc-menu-desannotate"
              onClick={() => {
                const anchors = selectedAnchorsNow();
                if (anchors.length > 0) applyBlockOp({ kind: "clearBlock", anchors });
                setMenu(null);
                clearClauseSelection();
              }}
              className="rounded-md border border-line px-2 py-1 text-xs text-ink hover:bg-panel-muted"
            >
              Désannoter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
