"use client";

/**
 * SelectionToolbar (Feature B) — barre flottante (bas du panneau central).
 *
 * Deux modes mutuellement exclusifs (priorité aux blocs s'ils sont sélectionnés) :
 *
 *  (P8) Sélection multi-BLOCS (`selectedClauseIds`, via right-drag ou double-clic d'un
 *   bloc) : « Annoter les blocs », « Étendre/Réduire » (si plage contiguë), « Désannoter
 *   le bloc ». Tout passe par `applyBlockOp` (lot atomique = UN undo).
 *
 *  (P4) Multi-sélection de PHRASES (`selectedSentences`, Maj/Cmd+clic) :
 *   « Annoter la sélection » et « Désannoter » via `applyBlockOp` (annotateRange /
 *   clearBlock), « Traduire la sélection », « Effacer ».
 *
 * Navigable clavier, focus visibles, contrastes AA (tokens). Aucune écriture span :
 * l'annotation reste PAR PHRASE (C4) ; le « bloc » est une vue dérivée.
 */

import { useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { ThemePalette } from "@/components/ui/ThemePalette";

export function SelectionToolbar() {
  const selected = useWorkspaceStore((s) => s.selectedSentences);
  const selectedClauseIds = useWorkspaceStore((s) => s.selectedClauseIds);
  const applyBlockOp = useWorkspaceStore((s) => s.applyBlockOp);
  const setTranslated = useWorkspaceStore((s) => s.setTranslated);
  const clearSelection = useWorkspaceStore((s) => s.clearSelection);
  const clearClauseSelection = useWorkspaceStore((s) => s.clearClauseSelection);
  const draftClauses = useWorkspaceStore((s) => s.draftClauses);
  const validateClauses = useWorkspaceStore((s) => s.validateClauses);
  const [palette, setPalette] = useState(false);

  // Mode BLOCS prioritaire (P8).
  if (selectedClauseIds.length > 0) {
    return (
      <BlockToolbar
        ids={selectedClauseIds}
        palette={palette}
        setPalette={setPalette}
        clear={() => {
          setPalette(false);
          clearClauseSelection();
        }}
      />
    );
  }

  if (selected.length === 0) return null;

  const sorted = selected.slice().sort((a, b) => a - b);

  function annotate(themeCode: string) {
    // C4/B2 — annotation PAR PHRASE en UN lot atomique (un seul undo) : une clause
    // par phrase sélectionnée → un bloc dérivé.
    applyBlockOp({ kind: "annotateRange", anchors: sorted, theme: themeCode });
    setPalette(false);
    clearSelection();
  }

  function desannotate() {
    applyBlockOp({ kind: "clearBlock", anchors: sorted });
    setPalette(false);
    clearSelection();
  }

  function translateSelection() {
    for (const i of selected) setTranslated(i, true);
    clearSelection();
  }

  function validateSelection() {
    // Point d — valide les clauses couvrant les phrases sélectionnées (confirme des
    // pré-remplissages en lot, sans re-thématiser). UN seul undo.
    const set = new Set(sorted);
    const ids = draftClauses.filter((d) => set.has(d.anchorIndex)).map((d) => d.localId);
    if (ids.length) validateClauses(ids, true);
    clearSelection();
  }

  return (
    <div
      role="toolbar"
      aria-label="Actions de sélection"
      data-testid="selection-toolbar"
      className="pointer-events-auto fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-col gap-2 rounded-lg border border-line bg-elevated p-2 shadow-xl"
    >
      <div className="flex items-center gap-2 text-sm text-ink">
        <span className="font-semibold" data-testid="selection-count">
          {selected.length} sélectionnée{selected.length > 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={() => setPalette((v) => !v)}
          aria-expanded={palette}
          data-testid="selection-annotate"
          className="rounded-md border border-line px-2 py-1 hover:bg-panel-muted"
        >
          Annoter la sélection
        </button>
        <button
          type="button"
          onClick={desannotate}
          data-testid="selection-desannotate"
          className="rounded-md border border-line px-2 py-1 hover:bg-panel-muted"
        >
          Désannoter
        </button>
        <button
          type="button"
          onClick={validateSelection}
          data-testid="selection-validate"
          title="Valider les clauses des phrases sélectionnées"
          className="rounded-md border border-emerald-400/50 px-2 py-1 text-emerald-300 hover:bg-emerald-400/10"
        >
          ✓ Valider
        </button>
        <button
          type="button"
          onClick={translateSelection}
          data-testid="selection-translate"
          className="rounded-md border border-line px-2 py-1 hover:bg-panel-muted"
        >
          Traduire la sélection
        </button>
        <button
          type="button"
          onClick={clearSelection}
          data-testid="selection-clear"
          className="rounded-md border border-line px-2 py-1 hover:bg-panel-muted"
        >
          Effacer
        </button>
      </div>
      {palette && (
        <div className="max-h-56 w-72 overflow-auto">
          <ThemePalette value={null} onChange={annotate} autoFocus />
        </div>
      )}
    </div>
  );
}

/** Barre flottante du mode multi-BLOCS (P8) — opère via applyBlockOp (lots atomiques). */
function BlockToolbar({
  ids,
  palette,
  setPalette,
  clear,
}: {
  ids: string[];
  palette: boolean;
  setPalette: (v: boolean | ((p: boolean) => boolean)) => void;
  clear: () => void;
}) {
  const drafts = useWorkspaceStore((s) => s.draftClauses);
  const nSentences = useWorkspaceStore((s) => s.nSentences);
  const applyBlockOp = useWorkspaceStore((s) => s.applyBlockOp);
  const validateClauses = useWorkspaceStore((s) => s.validateClauses);

  // Ancres + thème de la sélection ; contiguïté = bloc unique extensible/réductible.
  const sel = drafts.filter((d) => ids.includes(d.localId));
  const anchors = sel.map((d) => d.anchorIndex).sort((a, b) => a - b);
  const theme = sel[0]?.theme;
  const min = anchors[0];
  const max = anchors[anchors.length - 1];
  const contiguous =
    anchors.length > 0 &&
    theme != null &&
    max! - min! + 1 === anchors.length &&
    sel.every((d) => d.theme === theme);
  const canExtend = contiguous && max! + 1 < nSentences;
  const canShrink = contiguous && anchors.length > 1;

  function annotateBlocks(themeCode: string) {
    applyBlockOp({ kind: "annotateRange", anchors, theme: themeCode });
    setPalette(false);
    clear();
  }
  function desannotateBlock() {
    applyBlockOp({ kind: "clearBlock", anchors });
    clear();
  }

  return (
    <div
      role="toolbar"
      aria-label="Actions de sélection de blocs"
      data-testid="selection-toolbar"
      className="pointer-events-auto fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-col gap-2 rounded-lg border border-line bg-elevated p-2 shadow-xl"
    >
      <div className="flex items-center gap-2 text-sm text-ink">
        <span className="font-semibold" data-testid="block-select-count">
          {ids.length} phrase{ids.length > 1 ? "s" : ""} · bloc
        </span>
        <button
          type="button"
          onClick={() => setPalette((v) => !v)}
          aria-expanded={palette}
          data-testid="annotate-blocks"
          className="rounded-md border border-line px-2 py-1 hover:bg-panel-muted"
        >
          Annoter
        </button>
        <button
          type="button"
          onClick={() => applyBlockOp({ kind: "extend", anchors: [max! + 1], theme })}
          disabled={!canExtend}
          data-testid="block-extend"
          title="Étendre le bloc d'une phrase (vers le bas)"
          className="rounded-md border border-line px-2 py-1 hover:bg-panel-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          Étendre ＋
        </button>
        <button
          type="button"
          onClick={() => applyBlockOp({ kind: "shrink", anchors: [max!] })}
          disabled={!canShrink}
          data-testid="block-shrink"
          title="Réduire le bloc d'une phrase (par le bas)"
          className="rounded-md border border-line px-2 py-1 hover:bg-panel-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          Réduire −
        </button>
        <button
          type="button"
          onClick={desannotateBlock}
          data-testid="block-desannotate"
          className="rounded-md border border-line px-2 py-1 hover:bg-panel-muted"
        >
          Désannoter le bloc
        </button>
        <button
          type="button"
          onClick={() => {
            validateClauses(ids, true);
            clear();
          }}
          data-testid="block-validate"
          title="Valider toutes les clauses du bloc"
          className="rounded-md border border-emerald-400/50 px-2 py-1 text-emerald-300 hover:bg-emerald-400/10"
        >
          ✓ Valider le bloc
        </button>
        <button
          type="button"
          onClick={clear}
          data-testid="block-select-clear"
          className="rounded-md border border-line px-2 py-1 hover:bg-panel-muted"
        >
          Effacer
        </button>
      </div>
      {palette && (
        <div className="max-h-56 w-72 overflow-auto">
          <ThemePalette value={null} onChange={annotateBlocks} autoFocus />
        </div>
      )}
    </div>
  );
}
