"use client";

/**
 * SelectionToolbar (P4 + P8) — barre flottante (bas du panneau central).
 *
 * Deux modes mutuellement exclusifs (priorité aux blocs s'ils sont sélectionnés) :
 *
 *  (P8) Sélection multi-BLOCS (`selectedClauseIds`, via right-drag) :
 *   - « N bloc(s) » + « Annoter les blocs » (ThemePalette → applique le thème à
 *     TOUTES les clauses sélectionnées via updateDraft(localId,{theme})) + « Effacer ».
 *
 *  (P4) Multi-sélection de PHRASES (`selectedSentences`, Shift/Cmd+clic) :
 *   - « Annoter la sélection » : pose une frontière au 1er index sélectionné, supprime
 *     les ancres internes → la clause couvre la sélection.
 *   - « Traduire la sélection » : marque translated les phrases sélectionnées.
 *   - « Effacer » : vide la sélection.
 *
 * Navigable clavier, focus visibles, contrastes AA (tokens).
 */

import { useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { ThemePalette } from "@/components/ui/ThemePalette";

export function SelectionToolbar() {
  const selected = useWorkspaceStore((s) => s.selectedSentences);
  const selectedClauseIds = useWorkspaceStore((s) => s.selectedClauseIds);
  const drafts = useWorkspaceStore((s) => s.draftClauses);
  const setBoundary = useWorkspaceStore((s) => s.setBoundary);
  const removeBoundary = useWorkspaceStore((s) => s.removeBoundary);
  const updateDraft = useWorkspaceStore((s) => s.updateDraft);
  const setTranslated = useWorkspaceStore((s) => s.setTranslated);
  const clearSelection = useWorkspaceStore((s) => s.clearSelection);
  const clearClauseSelection = useWorkspaceStore((s) => s.clearClauseSelection);
  const [palette, setPalette] = useState(false);

  // Mode BLOCS prioritaire (P8).
  if (selectedClauseIds.length > 0) {
    return (
      <BlockToolbar
        ids={selectedClauseIds}
        palette={palette}
        setPalette={setPalette}
        annotateBlocks={(themeCode: string) => {
          for (const id of selectedClauseIds) updateDraft(id, { theme: themeCode });
          setPalette(false);
          clearClauseSelection();
        }}
        clear={() => {
          setPalette(false);
          clearClauseSelection();
        }}
      />
    );
  }

  if (selected.length === 0) return null;

  const sorted = selected.slice().sort((a, b) => a - b);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  function annotate(themeCode: string) {
    // Supprime toute ancre strictement à l'intérieur (entre first+1 et last) pour
    // que la clause posée au 1er index couvre toute la sélection.
    for (const d of drafts) {
      if (d.anchorIndex > first && d.anchorIndex <= last) removeBoundary(d.anchorIndex);
    }
    const existing = useWorkspaceStore.getState().draftClauses.find(
      (d) => d.anchorIndex === first,
    );
    if (existing) {
      updateDraft(existing.localId, { theme: themeCode });
    } else {
      setBoundary(first, themeCode);
    }
    setPalette(false);
    clearSelection();
  }

  function translateSelection() {
    for (const i of selected) setTranslated(i, true);
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

/** Barre flottante du mode multi-BLOCS (P8). */
function BlockToolbar({
  ids,
  palette,
  setPalette,
  annotateBlocks,
  clear,
}: {
  ids: string[];
  palette: boolean;
  setPalette: (v: boolean | ((p: boolean) => boolean)) => void;
  annotateBlocks: (themeCode: string) => void;
  clear: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Actions de sélection de blocs"
      data-testid="selection-toolbar"
      className="pointer-events-auto fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-col gap-2 rounded-lg border border-line bg-elevated p-2 shadow-xl"
    >
      <div className="flex items-center gap-2 text-sm text-ink">
        <span className="font-semibold" data-testid="block-select-count">
          {ids.length} bloc{ids.length > 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={() => setPalette((v) => !v)}
          aria-expanded={palette}
          data-testid="annotate-blocks"
          className="rounded-md border border-line px-2 py-1 hover:bg-panel-muted"
        >
          Annoter les blocs
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
