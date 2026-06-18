"use client";

/**
 * Store du workspace d'annotation (cœur du produit — F1, F2, F10, F12).
 *
 * Gère l'état LOCAL d'édition d'une annotation : sélection de phrase / clause,
 * brouillon de clauses (poser des ancres au clavier), overlays (injustice, fantôme
 * LLM), et le mode de pré-remplissage. La persistance serveur passe par react-query ;
 * ce store est l'état d'interaction temps réel, testable isolément.
 */

import { create } from "zustand";
import type { Certainty, Clause, PivotClause } from "@/types/contract";

export interface DraftClause {
  /** id local tant que non persisté ; sinon l'id serveur. */
  localId: string;
  serverId?: string;
  anchorIndex: number;
  theme: string;
  legalNature: string | null;
  evidenceSpan: string;
  rationale: string;
  certainty: Certainty | null;
  /** Provenance si issu d'un seed LLM (F2). */
  seededFrom?: string | null;
}

interface WorkspaceState {
  annotationId: string | null;
  nSentences: number;
  /** Phrase actuellement focalisée (navigation j/k). */
  focusedSentence: number;
  /** Clause sélectionnée dans l'inspecteur. */
  selectedClauseId: string | null;
  draftClauses: DraftClause[];
  /** Clauses « fantômes » LLM non retenues (F2 : comparaison). */
  ghostClauses: Array<{ anchorIndex: number; theme: string; judge: string }>;
  // Overlays togglables.
  showUnfairness: boolean;
  showGhostClaude: boolean;
  showGhostCodex: boolean;
  showTranslation: boolean;
  // Statut de dirty (modifs non snapshotées).
  dirty: boolean;

  // Actions
  init: (params: { annotationId: string; nSentences: number; clauses: Clause[] }) => void;
  focusSentence: (index: number) => void;
  moveFocus: (delta: number) => void;
  selectClause: (id: string | null) => void;
  /** Pose une frontière de clause sur la phrase focalisée (raccourci B / clic). */
  setBoundary: (anchorIndex: number, theme?: string) => void;
  removeBoundary: (anchorIndex: number) => void;
  updateDraft: (localId: string, patch: Partial<DraftClause>) => void;
  setCertainty: (localId: string, value: Certainty) => void;
  /** Charge un seed de pré-annotation comme brouillon éditable (F2). */
  seedFromPreAnnotation: (clauses: PivotClause[], judge: string) => void;
  setGhost: (clauses: Array<{ anchorIndex: number; theme: string }>, judge: string) => void;
  toggleUnfairness: () => void;
  toggleGhost: (judge: "claude" | "codex") => void;
  toggleTranslation: () => void;
  markClean: () => void;
  reset: () => void;
}

let localCounter = 0;
const nextLocalId = () => `local-${Date.now()}-${(localCounter += 1)}`;

function fromClause(c: Clause): DraftClause {
  return {
    localId: c.id,
    serverId: c.id,
    anchorIndex: c.anchorIndex,
    theme: c.theme,
    legalNature: c.legalNature ?? null,
    evidenceSpan: c.evidenceSpan ?? "",
    rationale: c.rationale ?? "",
    certainty: c.certainty ?? null,
    seededFrom: c.seededFrom ?? null,
  };
}

function sortDrafts(d: DraftClause[]): DraftClause[] {
  return d.slice().sort((a, b) => a.anchorIndex - b.anchorIndex);
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  annotationId: null,
  nSentences: 0,
  focusedSentence: 0,
  selectedClauseId: null,
  draftClauses: [],
  ghostClauses: [],
  showUnfairness: true,
  showGhostClaude: false,
  showGhostCodex: false,
  showTranslation: false,
  dirty: false,

  init: ({ annotationId, nSentences, clauses }) =>
    set({
      annotationId,
      nSentences,
      draftClauses: sortDrafts(clauses.map(fromClause)),
      focusedSentence: 0,
      selectedClauseId: clauses[0]?.id ?? null,
      dirty: false,
      ghostClauses: [],
    }),

  focusSentence: (index) =>
    set((s) => ({
      focusedSentence: Math.max(0, Math.min(index, Math.max(0, s.nSentences - 1))),
    })),

  moveFocus: (delta) =>
    set((s) => ({
      focusedSentence: Math.max(
        0,
        Math.min(s.focusedSentence + delta, Math.max(0, s.nSentences - 1)),
      ),
    })),

  selectClause: (id) => set({ selectedClauseId: id }),

  setBoundary: (anchorIndex, theme = "MISC_BOILERPLATE") =>
    set((s) => {
      if (s.draftClauses.some((c) => c.anchorIndex === anchorIndex)) {
        // Une ancre existe déjà : on la sélectionne plutôt que d'en créer une 2e.
        const existing = s.draftClauses.find((c) => c.anchorIndex === anchorIndex)!;
        return { selectedClauseId: existing.localId };
      }
      const draft: DraftClause = {
        localId: nextLocalId(),
        anchorIndex,
        theme,
        legalNature: null,
        evidenceSpan: "",
        rationale: "",
        certainty: null,
      };
      return {
        draftClauses: sortDrafts([...s.draftClauses, draft]),
        selectedClauseId: draft.localId,
        dirty: true,
      };
    }),

  removeBoundary: (anchorIndex) =>
    set((s) => ({
      draftClauses: s.draftClauses.filter((c) => c.anchorIndex !== anchorIndex),
      dirty: true,
    })),

  updateDraft: (localId, patch) =>
    set((s) => ({
      draftClauses: s.draftClauses.map((c) =>
        c.localId === localId ? { ...c, ...patch } : c,
      ),
      dirty: true,
    })),

  setCertainty: (localId, value) =>
    set((s) => ({
      draftClauses: s.draftClauses.map((c) =>
        c.localId === localId ? { ...c, certainty: value } : c,
      ),
      dirty: true,
    })),

  seedFromPreAnnotation: (clauses, judge) =>
    set((s) => {
      const existingAnchors = new Set(s.draftClauses.map((c) => c.anchorIndex));
      const seeded: DraftClause[] = clauses
        .filter((c) => !existingAnchors.has(c.anchor_index))
        .map((c) => ({
          localId: nextLocalId(),
          anchorIndex: c.anchor_index,
          theme: c.theme,
          legalNature: c.legal_nature ?? null,
          evidenceSpan: c.evidence_span ?? "",
          rationale: c.rationale ?? "",
          certainty: c.certainty ?? null,
          seededFrom: `preannotation:${judge}`,
        }));
      return {
        draftClauses: sortDrafts([...s.draftClauses, ...seeded]),
        dirty: true,
        selectedClauseId: seeded[0]?.localId ?? s.selectedClauseId,
      };
    }),

  setGhost: (clauses, judge) =>
    set((s) => ({
      ghostClauses: [
        ...s.ghostClauses.filter((g) => g.judge !== judge),
        ...clauses.map((c) => ({ ...c, judge })),
      ],
    })),

  toggleUnfairness: () => set((s) => ({ showUnfairness: !s.showUnfairness })),

  toggleGhost: (judge) =>
    set((s) =>
      judge === "claude"
        ? { showGhostClaude: !s.showGhostClaude }
        : { showGhostCodex: !s.showGhostCodex },
    ),

  toggleTranslation: () => set((s) => ({ showTranslation: !s.showTranslation })),

  markClean: () => set({ dirty: false }),

  reset: () =>
    set({
      annotationId: null,
      nSentences: 0,
      focusedSentence: 0,
      selectedClauseId: null,
      draftClauses: [],
      ghostClauses: [],
      dirty: false,
    }),
}));

/** Sélecteur : clause sélectionnée (draft). */
export function selectSelectedDraft(s: WorkspaceState): DraftClause | undefined {
  return s.draftClauses.find((c) => c.localId === s.selectedClauseId);
}
