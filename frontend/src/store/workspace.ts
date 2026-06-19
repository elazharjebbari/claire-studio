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

/** Source affichée dans le DocumentPanel (Q3). */
export type LlmSource = "human" | "claude" | "codex" | "compare";

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
  /** Affichage des frontières de clause (rail + pointillés). Défaut ON (P2). */
  showBoundaries: boolean;
  /** Multi-sélection de phrases (number[] pour la sérialisation/tests simples). */
  selectedSentences: number[];
  /** Multi-sélection de BLOCS/clauses (localId), via right-drag (P8). */
  selectedClauseIds: string[];
  /**
   * Mode d'affichage de langue (P10) : `orig` (VO seule), `both` (VO + FR sous
   * la phrase), `fr` (texte FR, repli VO si absent). Remplace l'ancien `translateAll`.
   */
  displayLang: "orig" | "both" | "fr";
  /** Phrases dont la traduction FR est affichée individuellement. */
  translatedSentences: number[];
  /**
   * Source de segmentation affichée dans le document (Q3) :
   *  - `human`   : annotation humaine (édition).
   *  - `claude` / `codex` : segmentation d'un juge en lecture seule.
   *  - `compare` : superposition de l'accord par phrase entre les deux juges.
   */
  llmSource: LlmSource;
  /** Version d'annotation LLM choisie (multi-versions). null = défaut backend. */
  llmVersion: string | null;
  // Statut de dirty (modifs non snapshotées).
  dirty: boolean;

  // Actions
  init: (params: { annotationId: string; nSentences: number; clauses: Clause[] }) => void;
  focusSentence: (index: number) => void;
  moveFocus: (delta: number) => void;
  selectClause: (id: string | null) => void;
  /**
   * Crée une clause à l'ancre donnée avec un thème EXPLICITE (Q2). Le thème est
   * requis : il n'existe plus de thème par défaut, donc aucune clause ne peut être
   * créée par accident. Si une ancre existe déjà à cet index, on la sélectionne.
   */
  setBoundary: (anchorIndex: number, theme: string) => void;
  removeBoundary: (anchorIndex: number) => void;
  updateDraft: (localId: string, patch: Partial<DraftClause>) => void;
  setCertainty: (localId: string, value: Certainty) => void;
  /** Charge un seed de pré-annotation comme brouillon éditable (F2). */
  seedFromPreAnnotation: (clauses: PivotClause[], judge: string) => void;
  setGhost: (clauses: Array<{ anchorIndex: number; theme: string }>, judge: string) => void;
  toggleUnfairness: () => void;
  toggleGhost: (judge: "claude" | "codex") => void;
  toggleTranslation: () => void;
  // Frontières / multi-sélection / traduction (P1).
  toggleBoundaries: () => void;
  selectRange: (from: number, to: number) => void;
  toggleSelected: (index: number) => void;
  clearSelection: () => void;
  /** Sélection multi-blocs (P8) : remplace la liste des clauses sélectionnées. */
  setSelectedClauses: (ids: string[]) => void;
  clearClauseSelection: () => void;
  setTranslated: (index: number, on: boolean) => void;
  /** Règle le mode d'affichage de langue (P10). */
  setDisplayLang: (lang: "orig" | "both" | "fr") => void;
  /** Règle la source de segmentation affichée (Q3). */
  setLlmSource: (source: LlmSource) => void;
  setLlmVersion: (version: string | null) => void;
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
  showBoundaries: true,
  selectedSentences: [],
  selectedClauseIds: [],
  displayLang: "orig",
  translatedSentences: [],
  llmSource: "human",
  llmVersion: null,
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
      selectedSentences: [],
      selectedClauseIds: [],
      translatedSentences: [],
      displayLang: "orig",
      llmSource: "human",
      llmVersion: null,
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

  setBoundary: (anchorIndex, theme) =>
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

  toggleBoundaries: () => set((s) => ({ showBoundaries: !s.showBoundaries })),

  selectRange: (from, to) =>
    set((s) => {
      const lo = Math.min(from, to);
      const hi = Math.max(from, to);
      const max = Math.max(0, s.nSentences - 1);
      const next: number[] = [];
      for (let i = Math.max(0, lo); i <= Math.min(hi, max); i += 1) next.push(i);
      return { selectedSentences: next };
    }),

  toggleSelected: (index) =>
    set((s) => {
      const has = s.selectedSentences.includes(index);
      const next = has
        ? s.selectedSentences.filter((i) => i !== index)
        : [...s.selectedSentences, index].sort((a, b) => a - b);
      return { selectedSentences: next };
    }),

  clearSelection: () => set({ selectedSentences: [] }),

  setSelectedClauses: (ids) =>
    set({ selectedClauseIds: Array.from(new Set(ids)) }),

  clearClauseSelection: () => set({ selectedClauseIds: [] }),

  setTranslated: (index, on) =>
    set((s) => {
      const has = s.translatedSentences.includes(index);
      if (on === has) return {};
      const next = on
        ? [...s.translatedSentences, index].sort((a, b) => a - b)
        : s.translatedSentences.filter((i) => i !== index);
      return { translatedSentences: next };
    }),

  setDisplayLang: (lang) => set({ displayLang: lang }),

  setLlmSource: (source) => set({ llmSource: source }),
  setLlmVersion: (version) => set({ llmVersion: version }),

  markClean: () => set({ dirty: false }),

  reset: () =>
    set({
      annotationId: null,
      nSentences: 0,
      focusedSentence: 0,
      selectedClauseId: null,
      draftClauses: [],
      ghostClauses: [],
      selectedSentences: [],
      selectedClauseIds: [],
      translatedSentences: [],
      displayLang: "orig",
      llmSource: "human",
      llmVersion: null,
      dirty: false,
    }),
}));

/** Sélecteur : clause sélectionnée (draft). */
export function selectSelectedDraft(s: WorkspaceState): DraftClause | undefined {
  return s.draftClauses.find((c) => c.localId === s.selectedClauseId);
}
