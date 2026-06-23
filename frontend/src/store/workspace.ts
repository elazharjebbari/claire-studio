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
import type {
  BoundaryKind,
  Certainty,
  Clause,
  PivotClause,
  ThemeTag,
  TriageLevel,
} from "@/types/contract";

/** Source affichée dans le DocumentPanel (Q3).
 *  "human" | "compare" | id de juge (claude/codex/mistral…, cf. LLM_JUDGES). */
export type LlmSource = "human" | "compare" | (string & {});

/** Juge pré-rempli courant (point 0a). null = aucun. `string` = id de juge (claude,
 *  codex, mistral, …) pour rester N-modèles. */
export type PrefillJudge = string | null;

/**
 * Entrée du journal d'actions humaines (point 2). Même taxonomie de verbes que
 * l'audit serveur (event-types.csv). Fonde l'affichage de l'historique et, au
 * cycle suivant, l'undo/redo. `localId`/`anchorIndex` permettent de recentrer le
 * document sur la cible de l'action.
 */
export interface ActionEntry {
  id: string;
  ts: number;
  kind: string;
  label: string;
  anchorIndex?: number;
  localId?: string;
}

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
  /**
   * Arbitrage de divergence (P1) : juge dont la proposition a été ADOPTÉE
   * explicitement sur cette clause. Alimente le « voyant » visuel. null = décision
   * humaine non issue d'un arbitrage LLM ponctuel.
   */
  resolvedFrom?: string | null;
  /**
   * Validation humaine explicite (point d). true = l'annotateur a validé cette clause
   * (saisie manuelle, adoption d'un modèle, ou confirmation d'un pré-remplissage). Un
   * pré-remplissage non confirmé reste false : il aide mais ne fait jamais référence.
   */
  validated?: boolean;
  /**
   * Multi-label (protocole C1–C5) : ensemble de thèmes (1 primaire + N secondaires).
   * Le scalaire `theme` reste le miroir du primaire. Absent ⇒ mono = [{theme, primary}].
   */
  themes?: ThemeTag[];
  /** Frontière d'ouverture (dure/molle) + support inter-juges (additif). */
  boundary?: { type: BoundaryKind; support: number };
  /** Niveau de triage C1–C5 (orthogonal à la certitude 0–3). */
  triageLevel?: TriageLevel | null;
}

/**
 * Opération de LOT sur un bloc (Feature B). `annotateRange`/`extend` posent un thème
 * sur les phrases ; `shrink`/`clearBlock` les désannotent. Appliquée atomiquement
 * (un seul snapshot undo) par `applyBlockOp`.
 */
export interface BlockOp {
  kind: "annotateRange" | "extend" | "shrink" | "clearBlock";
  /** Phrases ciblées (ancres). */
  anchors: number[];
  /** Thème à poser (requis pour annotateRange/extend ; ignoré pour shrink/clearBlock). */
  theme?: string;
}

/** Décision de triage acceptée pour une phrase (annotation assistée C1–C5). */
export interface TriageDecision {
  anchorIndex: number;
  /** Ensemble multi-label : exactement 1 primaire + N secondaires. */
  themes: ThemeTag[];
  boundary?: { type: BoundaryKind; support: number };
  triageLevel?: TriageLevel;
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
  /** Visibilité du fantôme LLM par juge (claude/codex/mistral…). absent/false = masqué. */
  ghostJudges: Record<string, boolean>;
  showTranslation: boolean;
  /** Affichage des frontières de clause (rail + pointillés). Défaut ON (P2). */
  showBoundaries: boolean;
  /** Overlay du niveau de triage C1–C5 dans le document (pastille/liseré). Défaut OFF
   *  (subtil, opt-in) — code couleur partagé `TRIAGE_LEVEL_META`. */
  showTriageLevels: boolean;
  /** Rail d'actions rapides dans la gouttière gauche (valider+suivant / recommandation).
   *  Défaut OFF (opt-in) — élargit le padding gauche et décale la piste de validation. */
  showQuickActions: boolean;
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
  /** Panneau comparatif latéral visible (P4). */
  showComparePanel: boolean;
  /** Overlay d'attribution multi-annotateurs (qui a touché quoi) — point 3. */
  showAttribution: boolean;
  /** Juge pré-rempli courant (point 0a). */
  prefilledJudge: PrefillJudge;
  /** Journal des actions humaines de la session (point 2). */
  actionLog: ActionEntry[];
  /** Pile d'annulation : snapshots de draftClauses AVANT chaque mutation (point 4a). */
  undoStack: DraftClause[][];
  /** Pile de rétablissement (point 4a). */
  redoStack: DraftClause[][];
  /**
   * Lecture seule (R1) : MA session est éditable ; l'annotation d'un AUTRE
   * annotateur est consultable mais NON modifiable (intégrité IAA). Quand vrai,
   * tous les mutateurs de CONTENU sont neutralisés (no-op) — la navigation, la
   * sélection et les overlays restent disponibles.
   */
  readOnly: boolean;
  // Statut de dirty (modifs non snapshotées).
  dirty: boolean;

  // Actions
  init: (params: {
    annotationId: string;
    nSentences: number;
    clauses: Clause[];
    readOnly?: boolean;
  }) => void;
  focusSentence: (index: number) => void;
  moveFocus: (delta: number) => void;
  selectClause: (id: string | null) => void;
  /**
   * Crée une clause à l'ancre donnée avec un thème EXPLICITE (Q2). Le thème est
   * requis : il n'existe plus de thème par défaut, donc aucune clause ne peut être
   * créée par accident. Si une ancre existe déjà à cet index, on la sélectionne.
   */
  setBoundary: (anchorIndex: number, theme: string) => void;
  /**
   * Acceptation d'une suggestion de triage (annotation assistée C1–C5). Upsert de la
   * clause à l'ancre : pose l'ensemble MULTI-LABEL (primaire + secondaires), la frontière
   * (dure/molle) et le niveau, et marque `validated`. Crée si absente, met à jour sinon
   * (une phrase déjà seedée d'un LLM → simple update, donc PAS de 409). Un seul snapshot
   * d'undo, sélectionne la clause et focalise la phrase. No-op en lecture seule (R1).
   * `applyTriageBatch` applique N décisions en UNE transaction d'undo (lot C1/sélection).
   */
  applyTriageDecision: (params: TriageDecision) => void;
  applyTriageBatch: (decisions: TriageDecision[]) => void;
  /**
   * Toggle d'annotation (C3) : depuis le menu d'une phrase. Aucune clause → crée
   * (thème) ; clause de thème DIFFÉRENT → re-thématise ; clause de MÊME thème →
   * supprime (désannotation). Permet d'annoter/désannoter d'un même geste.
   */
  toggleBoundary: (anchorIndex: number, theme: string) => void;
  /**
   * Primitive de LOT (Feature B, spec §5) : applique une suite de mutations comme UNE
   * transaction d'undo (un seul snapshot, une seule entrée actionLog, un seul rendu).
   * Sert aux gestes de bloc : annoter une plage, étendre/réduire, désannoter un bloc.
   * No-op en lecture seule (R1) ; ancres hors [0, nSentences) ignorées.
   */
  applyBlockOp: (op: BlockOp) => void;
  /**
   * Arbitrage de divergence (P1) : adopte la proposition d'un juge à l'ancre donnée.
   * Crée la clause humaine si absente (thème du juge), sinon met à jour son thème ;
   * marque `resolvedFrom` = juge pour le voyant. Toujours `dirty=true`.
   */
  resolveDivergence: (anchorIndex: number, judge: string, theme: string) => void;
  /**
   * Adoption d'un SEGMENT entier d'un juge (point d/UX) : crée/met à jour une clause
   * VALIDÉE (resolvedFrom=judge, thème) pour CHAQUE phrase de [start, end] — pas
   * seulement l'ancre. UN seul snapshot d'undo. Sert à accepter toute une frontière LLM.
   */
  resolveDivergenceRange: (start: number, end: number, judge: string, theme: string) => void;
  removeBoundary: (anchorIndex: number) => void;
  updateDraft: (localId: string, patch: Partial<DraftClause>) => void;
  /**
   * Validation humaine (point d). `setValidated` (re)marque UNE clause ; `validateClauses`
   * traite un lot (sélection / bloc) en UN snapshot d'undo. Valider = confirmer que la
   * clause est la référence (les pré-annotations non validées ne comptent pas pour la
   * soumission). No-op en lecture seule.
   */
  setValidated: (localId: string, value: boolean) => void;
  validateClauses: (localIds: string[], value: boolean) => void;
  setCertainty: (localId: string, value: Certainty) => void;
  /** Charge un seed de pré-annotation comme brouillon éditable (F2). */
  seedFromPreAnnotation: (clauses: PivotClause[], judge: string) => void;
  /**
   * Pré-remplissage COMMUTABLE (point 0a). Remplace les clauses issues d'un
   * pré-remplissage antérieur (`seededFrom` = "preannotation:*") par celles du juge
   * donné, en PRÉSERVANT les clauses humaines (seededFrom nul). Passer `null`
   * efface le pré-remplissage. Met à jour `prefilledJudge`.
   */
  replacePrefill: (clauses: PivotClause[], judge: PrefillJudge) => void;
  setGhost: (clauses: Array<{ anchorIndex: number; theme: string }>, judge: string) => void;
  toggleUnfairness: () => void;
  toggleGhost: (judge: string) => void;
  toggleTranslation: () => void;
  // Frontières / multi-sélection / traduction (P1).
  toggleBoundaries: () => void;
  toggleTriageLevels: () => void;
  toggleQuickActions: () => void;
  selectRange: (from: number, to: number) => void;
  toggleSelected: (index: number) => void;
  /** Sélection ARBITRAIRE (axe 4) : remplace la sélection par cet ensemble d'index
   *  (dédupliqués, triés, bornés à [0, nSentences)). Sert aux sélections « tout le
   *  thème courant » non contiguës. */
  setSelection: (indices: number[]) => void;
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
  /** Bascule le panneau comparatif latéral (P4). */
  toggleComparePanel: () => void;
  /** Bascule l'overlay d'attribution (point 3). */
  toggleAttribution: () => void;
  /** Vide le journal d'actions (ex. après soumission). */
  clearActionLog: () => void;
  /** Annule la dernière mutation de clauses (point 4a). */
  undo: () => void;
  /** Rétablit la dernière mutation annulée (point 4a). */
  redo: () => void;
  markClean: () => void;
  reset: () => void;
}

let localCounter = 0;
const nextLocalId = () => `local-${Date.now()}-${(localCounter += 1)}`;

let logCounter = 0;
const ACTION_LOG_CAP = 200;
/** Ajoute une entrée au journal d'actions, borné à ACTION_LOG_CAP. */
function appendLog(log: ActionEntry[], e: Omit<ActionEntry, "id" | "ts">): ActionEntry[] {
  const entry: ActionEntry = { id: `act-${Date.now()}-${(logCounter += 1)}`, ts: Date.now(), ...e };
  const next = [...log, entry];
  return next.length > ACTION_LOG_CAP ? next.slice(next.length - ACTION_LOG_CAP) : next;
}

const UNDO_DEPTH = 200;
/** Empile un snapshot de draftClauses sur la pile d'annulation (borné). */
function pushUndo(stack: DraftClause[][], snapshot: DraftClause[]): DraftClause[][] {
  const next = [...stack, snapshot];
  return next.length > UNDO_DEPTH ? next.slice(next.length - UNDO_DEPTH) : next;
}

/** Libellé lisible d'une opération de bloc pour le journal d'actions. */
function blockOpLabel(op: BlockOp, anchors: number[]): string {
  const lo = anchors[0]!;
  const hi = anchors[anchors.length - 1]!;
  const range = lo === hi ? `${lo}` : `${lo}–${hi}`;
  const n = anchors.length;
  const s = n > 1 ? "s" : "";
  switch (op.kind) {
    case "annotateRange":
      return `Bloc ${op.theme} ${range} (${n} phrase${s})`;
    case "extend":
      return `Extension ${op.theme} → ${range}`;
    case "shrink":
      return `Réduction ${range} (${n} phrase${s})`;
    case "clearBlock":
      return `Bloc retiré ${range} (${n} phrase${s})`;
  }
}

function fromClause(c: Clause): DraftClause {
  return {
    // String(...) : l'API peut sérialiser l'id en NOMBRE ; on garde localId/serverId
    // en chaîne pour que clientOpId (=localId) reste une chaîne (évite le 500 backend
    // 'int has no strip' lors d'un undo qui recrée une clause déjà persistée).
    localId: String(c.id),
    serverId: String(c.id),
    anchorIndex: c.anchorIndex,
    theme: c.theme,
    legalNature: c.legalNature ?? null,
    evidenceSpan: c.evidenceSpan ?? "",
    rationale: c.rationale ?? "",
    certainty: c.certainty ?? null,
    seededFrom: c.seededFrom ?? null,
    resolvedFrom: null,
    validated: c.validated ?? false,
    // Multi-label / frontière / niveau (additif) : préservés à l'aller-retour serveur
    // → le rendu document (rail, badge, plan, inspecteur) garde le multi-label après accept.
    themes: c.themes,
    boundary: c.boundary,
    triageLevel: c.triageLevel ?? null,
  };
}

function sortDrafts(d: DraftClause[]): DraftClause[] {
  return d.slice().sort((a, b) => a.anchorIndex - b.anchorIndex);
}

/** Thème primaire d'un ensemble multi-label (repli sur le 1ᵉʳ si aucun rôle primary). */
function primaryOf(themes: ThemeTag[]): string {
  return themes.find((t) => t.role === "primary")?.label ?? themes[0]?.label ?? "";
}

/**
 * Applique UNE décision de triage à un tableau de drafts (PUR, sans set/undo) : upsert
 * par ancre. Retourne le nouveau tableau + le localId de la clause touchée. Si l'ancre
 * existe (ex. seed LLM), c'est une mise à jour en place — l'autosave la persiste en PATCH
 * (donc pas de 409). Sinon création d'un draft validé.
 */
function upsertDecision(
  drafts: DraftClause[],
  d: TriageDecision,
): { drafts: DraftClause[]; localId: string } {
  const primary = primaryOf(d.themes);
  const existing = drafts.find((c) => c.anchorIndex === d.anchorIndex);
  if (existing) {
    return {
      drafts: drafts.map((c) =>
        c.localId === existing.localId
          ? {
              ...c,
              theme: primary,
              themes: d.themes,
              boundary: d.boundary ?? c.boundary,
              triageLevel: d.triageLevel ?? c.triageLevel ?? null,
              validated: true,
            }
          : c,
      ),
      localId: existing.localId,
    };
  }
  const draft: DraftClause = {
    localId: nextLocalId(),
    anchorIndex: d.anchorIndex,
    theme: primary,
    legalNature: null,
    evidenceSpan: "",
    rationale: "",
    certainty: null,
    validated: true,
    themes: d.themes,
    boundary: d.boundary,
    triageLevel: d.triageLevel ?? null,
  };
  return { drafts: sortDrafts([...drafts, draft]), localId: draft.localId };
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  annotationId: null,
  nSentences: 0,
  focusedSentence: 0,
  selectedClauseId: null,
  draftClauses: [],
  ghostClauses: [],
  showUnfairness: true,
  ghostJudges: {},
  showTranslation: false,
  showBoundaries: true,
  showTriageLevels: false,
  showQuickActions: false,
  selectedSentences: [],
  selectedClauseIds: [],
  displayLang: "orig",
  translatedSentences: [],
  llmSource: "human",
  llmVersion: null,
  showComparePanel: false,
  showAttribution: false,
  prefilledJudge: null,
  actionLog: [],
  undoStack: [],
  redoStack: [],
  readOnly: false,
  dirty: false,

  init: ({ annotationId, nSentences, clauses, readOnly = false }) =>
    set({
      annotationId,
      nSentences,
      readOnly,
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
      showComparePanel: false,
      showAttribution: false,
      prefilledJudge: null,
      actionLog: [],
      undoStack: [],
      redoStack: [],
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
      if (s.readOnly) return {};
      const existing = s.draftClauses.find((c) => c.anchorIndex === anchorIndex);
      if (existing) {
        // Une ancre existe déjà : choisir un thème RE-THÉMATISE la clause en place
        // (corrige le bug couleur §6 — rail/badge dérivent du thème de la clause
        // couvrante). Thème inchangé → simple (re)sélection, sans marquer dirty.
        if (existing.theme === theme) {
          return { selectedClauseId: existing.localId };
        }
        return {
          // Re-thématisation humaine = décision validée (point d).
          draftClauses: s.draftClauses.map((c) =>
            c.localId === existing.localId ? { ...c, theme, validated: true } : c,
          ),
          selectedClauseId: existing.localId,
          dirty: true,
          undoStack: pushUndo(s.undoStack, s.draftClauses),
          redoStack: [],
          actionLog: appendLog(s.actionLog, {
            kind: "clause.retheme",
            label: `Thème → ${theme} @${anchorIndex}`,
            anchorIndex,
            localId: existing.localId,
          }),
        };
      }
      const draft: DraftClause = {
        localId: nextLocalId(),
        anchorIndex,
        theme,
        legalNature: null,
        evidenceSpan: "",
        rationale: "",
        certainty: null,
        // Annotation manuelle = clause validée d'office (point d).
        validated: true,
      };
      return {
        draftClauses: sortDrafts([...s.draftClauses, draft]),
        selectedClauseId: draft.localId,
        dirty: true,
        undoStack: pushUndo(s.undoStack, s.draftClauses),
        redoStack: [],
        actionLog: appendLog(s.actionLog, {
          kind: "clause.create",
          label: `Clause ${theme} créée @${anchorIndex}`,
          anchorIndex,
          localId: draft.localId,
        }),
      };
    }),

  applyTriageDecision: (params) =>
    set((s) => {
      if (s.readOnly) return {};
      if (!params.themes.length) return {};
      const { drafts, localId } = upsertDecision(s.draftClauses, params);
      const primary = primaryOf(params.themes);
      return {
        draftClauses: drafts,
        selectedClauseId: localId,
        focusedSentence: Math.max(
          0,
          Math.min(params.anchorIndex, Math.max(0, s.nSentences - 1)),
        ),
        dirty: true,
        undoStack: pushUndo(s.undoStack, s.draftClauses),
        redoStack: [],
        actionLog: appendLog(s.actionLog, {
          kind: "triage.accept",
          label: `Triage ${params.triageLevel ?? ""} → ${primary} @${params.anchorIndex}`.trim(),
          anchorIndex: params.anchorIndex,
          localId,
        }),
      };
    }),

  applyTriageBatch: (decisions) =>
    set((s) => {
      if (s.readOnly) return {};
      const valid = decisions.filter((d) => d.themes.length);
      if (!valid.length) return {};
      let drafts = s.draftClauses;
      for (const d of valid) drafts = upsertDecision(drafts, d).drafts;
      return {
        draftClauses: drafts,
        dirty: true,
        // UN seul snapshot d'undo pour tout le lot.
        undoStack: pushUndo(s.undoStack, s.draftClauses),
        redoStack: [],
        actionLog: appendLog(s.actionLog, {
          kind: "triage.batch",
          label: `Triage : ${valid.length} clause${valid.length > 1 ? "s" : ""} acceptée${valid.length > 1 ? "s" : ""}`,
        }),
      };
    }),

  toggleBoundary: (anchorIndex, theme) => {
    const { readOnly, draftClauses, removeBoundary, setBoundary } = get();
    if (readOnly) return;
    const existing = draftClauses.find((c) => c.anchorIndex === anchorIndex);
    // Même thème déjà posé → désannotation ; sinon création / re-thématisation.
    if (existing && existing.theme === theme) removeBoundary(anchorIndex);
    else setBoundary(anchorIndex, theme);
  },

  applyBlockOp: (op) =>
    set((s) => {
      if (s.readOnly) return {};
      const N = s.nSentences;
      // Ancres valides, dédupliquées, triées.
      const anchors = Array.from(
        new Set(op.anchors.filter((i) => Number.isInteger(i) && i >= 0 && i < N)),
      ).sort((a, b) => a - b);
      if (anchors.length === 0) return {};
      const remove = op.kind === "shrink" || op.kind === "clearBlock";

      let drafts = s.draftClauses.slice();
      let changed = false;

      if (remove) {
        const targets = new Set(anchors);
        const next = drafts.filter((c) => !targets.has(c.anchorIndex));
        if (next.length !== drafts.length) {
          drafts = next;
          changed = true;
        }
      } else {
        const theme = op.theme;
        if (!theme) return {};
        for (const i of anchors) {
          const idx = drafts.findIndex((c) => c.anchorIndex === i);
          if (idx >= 0) {
            if (drafts[idx]!.theme !== theme || !drafts[idx]!.validated) {
              // Geste de bloc humain = décision validée (point d).
              drafts[idx] = { ...drafts[idx]!, theme, validated: true };
              changed = true;
            }
          } else {
            drafts.push({
              localId: nextLocalId(),
              anchorIndex: i,
              theme,
              legalNature: null,
              evidenceSpan: "",
              rationale: "",
              certainty: null,
              validated: true,
            });
            changed = true;
          }
        }
      }

      if (!changed) return {}; // idempotent : aucun changement net → pas de snapshot.

      drafts = sortDrafts(drafts);
      const firstAnchor = anchors[0]!;
      const selected =
        drafts.find((c) => c.anchorIndex === firstAnchor)?.localId ??
        (drafts.some((c) => c.localId === s.selectedClauseId) ? s.selectedClauseId : null);

      return {
        draftClauses: drafts,
        dirty: true,
        // UN SEUL snapshot pour tout le lot (atomicité d'undo, spec §5).
        undoStack: pushUndo(s.undoStack, s.draftClauses),
        redoStack: [],
        selectedClauseId: selected,
        actionLog: appendLog(s.actionLog, {
          kind: `block.${op.kind}`,
          label: blockOpLabel(op, anchors),
          anchorIndex: firstAnchor,
        }),
      };
    }),

  resolveDivergence: (anchorIndex, judge, theme) =>
    set((s) => {
      if (s.readOnly) return {};
      const existing = s.draftClauses.find((c) => c.anchorIndex === anchorIndex);
      if (existing) {
        return {
          draftClauses: s.draftClauses.map((c) =>
            c.localId === existing.localId
              ? { ...c, theme, resolvedFrom: judge, validated: true }
              : c,
          ),
          selectedClauseId: existing.localId,
          dirty: true,
          undoStack: pushUndo(s.undoStack, s.draftClauses),
          redoStack: [],
          actionLog: appendLog(s.actionLog, {
            kind: "divergence.adopt",
            label: `Adopté ${judge} (${theme}) @${anchorIndex}`,
            anchorIndex,
            localId: existing.localId,
          }),
        };
      }
      const draft: DraftClause = {
        localId: nextLocalId(),
        anchorIndex,
        theme,
        legalNature: null,
        evidenceSpan: "",
        rationale: "",
        certainty: null,
        seededFrom: null,
        resolvedFrom: judge,
        validated: true,
      };
      return {
        draftClauses: sortDrafts([...s.draftClauses, draft]),
        selectedClauseId: draft.localId,
        dirty: true,
        undoStack: pushUndo(s.undoStack, s.draftClauses),
        redoStack: [],
        actionLog: appendLog(s.actionLog, {
          kind: "divergence.adopt",
          label: `Adopté ${judge} (${theme}) @${anchorIndex}`,
          anchorIndex,
          localId: draft.localId,
        }),
      };
    }),

  resolveDivergenceRange: (start, end, judge, theme) =>
    set((s) => {
      if (s.readOnly) return {};
      const lo = Math.max(0, Math.min(start, end));
      const hi = Math.min(s.nSentences - 1, Math.max(start, end));
      if (hi < lo) return {};
      const byAnchor = new Map(s.draftClauses.map((c) => [c.anchorIndex, c]));
      let drafts = s.draftClauses.slice();
      let changed = false;
      for (let i = lo; i <= hi; i += 1) {
        const existing = byAnchor.get(i);
        if (existing) {
          if (existing.theme !== theme || existing.resolvedFrom !== judge || !existing.validated) {
            drafts = drafts.map((c) =>
              c.localId === existing.localId
                ? { ...c, theme, resolvedFrom: judge, validated: true }
                : c,
            );
            changed = true;
          }
        } else {
          drafts.push({
            localId: nextLocalId(),
            anchorIndex: i,
            theme,
            legalNature: null,
            evidenceSpan: "",
            rationale: "",
            certainty: null,
            seededFrom: null,
            resolvedFrom: judge,
            validated: true,
          });
          changed = true;
        }
      }
      if (!changed) return {};
      return {
        draftClauses: sortDrafts(drafts),
        selectedClauseId: byAnchor.get(lo)?.localId ?? s.selectedClauseId,
        dirty: true,
        undoStack: pushUndo(s.undoStack, s.draftClauses),
        redoStack: [],
        actionLog: appendLog(s.actionLog, {
          kind: "divergence.adopt",
          label: `Adopté ${judge} (${theme}) ${lo}–${hi}`,
          anchorIndex: lo,
        }),
      };
    }),

  removeBoundary: (anchorIndex) =>
    set((s) =>
      s.readOnly
        ? {}
        : {
            draftClauses: s.draftClauses.filter((c) => c.anchorIndex !== anchorIndex),
            dirty: true,
            undoStack: pushUndo(s.undoStack, s.draftClauses),
            redoStack: [],
            actionLog: appendLog(s.actionLog, {
              kind: "clause.delete",
              label: `Clause supprimée @${anchorIndex}`,
              anchorIndex,
            }),
          },
    ),

  updateDraft: (localId, patch) =>
    set((s) => {
      if (s.readOnly) return {};
      const target = s.draftClauses.find((c) => c.localId === localId);
      const field = Object.keys(patch)[0] ?? "champ";
      const verb =
        "theme" in patch ? "clause.retheme" : `clause.set_${field}`;
      return {
        draftClauses: s.draftClauses.map((c) =>
          c.localId === localId ? { ...c, ...patch } : c,
        ),
        dirty: true,
        undoStack: pushUndo(s.undoStack, s.draftClauses),
        redoStack: [],
        actionLog: appendLog(s.actionLog, {
          kind: verb,
          label:
            "theme" in patch
              ? `Thème → ${patch.theme} @${target?.anchorIndex ?? "?"}`
              : `Édition ${field} @${target?.anchorIndex ?? "?"}`,
          anchorIndex: target?.anchorIndex,
          localId,
        }),
      };
    }),

  setCertainty: (localId, value) =>
    set((s) => {
      if (s.readOnly) return {};
      const target = s.draftClauses.find((c) => c.localId === localId);
      return {
        draftClauses: s.draftClauses.map((c) =>
          c.localId === localId ? { ...c, certainty: value } : c,
        ),
        dirty: true,
        undoStack: pushUndo(s.undoStack, s.draftClauses),
        redoStack: [],
        actionLog: appendLog(s.actionLog, {
          kind: "clause.set_certainty",
          label: `Certitude ${value} @${target?.anchorIndex ?? "?"}`,
          anchorIndex: target?.anchorIndex,
          localId,
        }),
      };
    }),

  setValidated: (localId, value) =>
    set((s) => {
      if (s.readOnly) return {};
      const target = s.draftClauses.find((c) => c.localId === localId);
      if (!target || (target.validated ?? false) === value) return {};
      return {
        draftClauses: s.draftClauses.map((c) =>
          c.localId === localId ? { ...c, validated: value } : c,
        ),
        dirty: true,
        undoStack: pushUndo(s.undoStack, s.draftClauses),
        redoStack: [],
        actionLog: appendLog(s.actionLog, {
          kind: value ? "clause.validate" : "clause.invalidate",
          label: `${value ? "Validé" : "Dévalidé"} @${target.anchorIndex}`,
          anchorIndex: target.anchorIndex,
          localId,
        }),
      };
    }),

  validateClauses: (localIds, value) =>
    set((s) => {
      if (s.readOnly) return {};
      const ids = new Set(localIds);
      let changed = false;
      const draftClauses = s.draftClauses.map((c) => {
        if (ids.has(c.localId) && (c.validated ?? false) !== value) {
          changed = true;
          return { ...c, validated: value };
        }
        return c;
      });
      if (!changed) return {};
      return {
        draftClauses,
        dirty: true,
        // UN SEUL snapshot pour tout le lot (atomicité d'undo).
        undoStack: pushUndo(s.undoStack, s.draftClauses),
        redoStack: [],
        actionLog: appendLog(s.actionLog, {
          kind: value ? "block.validate" : "block.invalidate",
          label: `${value ? "Validé" : "Dévalidé"} ${ids.size} clause${ids.size > 1 ? "s" : ""}`,
        }),
      };
    }),

  seedFromPreAnnotation: (clauses, judge) =>
    set((s) => {
      if (s.readOnly) return {};
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

  replacePrefill: (clauses, judge) =>
    set((s) => {
      if (s.readOnly) return {};
      // « Aucun » : retire les clauses issues d'un pré-remplissage (préserve l'humain
      // et les arbitrages resolvedFrom). Annulable.
      if (judge == null) {
        const kept = s.draftClauses.filter(
          (c) => !(c.seededFrom?.startsWith("preannotation:") && !c.resolvedFrom),
        );
        if (kept.length === s.draftClauses.length) return { prefilledJudge: null };
        return {
          draftClauses: kept,
          prefilledJudge: null,
          dirty: true,
          undoStack: pushUndo(s.undoStack, s.draftClauses),
          redoStack: [],
          actionLog: appendLog(s.actionLog, {
            kind: "prefill.clear",
            label: "Pré-remplissage retiré",
          }),
        };
      }
      // ÉCRASEMENT (demande utilisateur) : la segmentation du juge REMPLACE toute
      // l'annotation courante (humaine COMPRISE), dépliée PAR PHRASE et éditable
      // ensuite. Action ANNULABLE (un seul snapshot undo) — la confirmation explicite
      // est gérée par l'UI (WorkspaceToolbar) avant l'appel.
      const segs = clauses.slice().sort((a, b) => a.anchor_index - b.anchor_index);
      const seeded: DraftClause[] = [];
      for (let k = 0; k < segs.length; k += 1) {
        const seg = segs[k]!;
        const end = (segs[k + 1]?.anchor_index ?? s.nSentences) - 1;
        for (let idx = seg.anchor_index; idx <= end && idx < s.nSentences; idx += 1) {
          if (idx < 0) continue;
          seeded.push({
            localId: nextLocalId(),
            anchorIndex: idx,
            theme: seg.theme,
            legalNature: seg.legal_nature ?? null,
            evidenceSpan: seg.evidence_span ?? "",
            rationale: seg.rationale ?? "",
            certainty: seg.certainty ?? null,
            seededFrom: `preannotation:${judge}`,
            resolvedFrom: null,
          });
        }
      }
      return {
        draftClauses: sortDrafts(seeded),
        prefilledJudge: judge,
        selectedClauseId: seeded[0]?.localId ?? null,
        dirty: true,
        undoStack: pushUndo(s.undoStack, s.draftClauses),
        redoStack: [],
        actionLog: appendLog(s.actionLog, {
          kind: "prefill.overwrite",
          label: `Annotation remplacée par ${judge} (${seeded.length} phrases)`,
        }),
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
    set((s) => ({ ghostJudges: { ...s.ghostJudges, [judge]: !s.ghostJudges[judge] } })),

  toggleTranslation: () => set((s) => ({ showTranslation: !s.showTranslation })),

  toggleBoundaries: () => set((s) => ({ showBoundaries: !s.showBoundaries })),
  toggleTriageLevels: () => set((s) => ({ showTriageLevels: !s.showTriageLevels })),
  toggleQuickActions: () => set((s) => ({ showQuickActions: !s.showQuickActions })),

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

  setSelection: (indices) =>
    set((s) => {
      const max = Math.max(0, s.nSentences - 1);
      const next = Array.from(
        new Set(indices.filter((i) => Number.isInteger(i) && i >= 0 && i <= max)),
      ).sort((a, b) => a - b);
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

  toggleComparePanel: () => set((s) => ({ showComparePanel: !s.showComparePanel })),

  toggleAttribution: () => set((s) => ({ showAttribution: !s.showAttribution })),

  clearActionLog: () => set({ actionLog: [] }),

  undo: () =>
    set((s) => {
      if (s.readOnly || s.undoStack.length === 0) return {};
      const prev = s.undoStack[s.undoStack.length - 1]!;
      const validSel = prev.some((c) => c.localId === s.selectedClauseId)
        ? s.selectedClauseId
        : null;
      return {
        draftClauses: prev,
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, s.draftClauses],
        selectedClauseId: validSel,
        dirty: true,
        actionLog: appendLog(s.actionLog, { kind: "undo", label: "Annulation" }),
      };
    }),

  redo: () =>
    set((s) => {
      if (s.readOnly || s.redoStack.length === 0) return {};
      const next = s.redoStack[s.redoStack.length - 1]!;
      const validSel = next.some((c) => c.localId === s.selectedClauseId)
        ? s.selectedClauseId
        : null;
      return {
        draftClauses: next,
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, s.draftClauses],
        selectedClauseId: validSel,
        dirty: true,
        actionLog: appendLog(s.actionLog, { kind: "redo", label: "Rétablissement" }),
      };
    }),

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
      showComparePanel: false,
      showAttribution: false,
      prefilledJudge: null,
      actionLog: [],
      undoStack: [],
      redoStack: [],
      readOnly: false,
      dirty: false,
    }),
}));

/** Sélecteur : clause sélectionnée (draft). */
export function selectSelectedDraft(s: WorkspaceState): DraftClause | undefined {
  return s.draftClauses.find((c) => c.localId === s.selectedClauseId);
}
