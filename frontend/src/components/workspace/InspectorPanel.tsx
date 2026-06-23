"use client";

/**
 * Panneau droit — Inspecteur de la clause sélectionnée (navigation.md §3) :
 * thème (ThemePalette), nature juridique, certitude 0–3, evidence span, rationale,
 * commentaires (F9), provenance/diff LLM. Édite le brouillon local (store).
 *
 * Q2 : si la phrase focalisée n'a PAS de clause, l'inspecteur n'affiche pas l'éditeur
 * mais un état « créer une clause » : une ThemePalette dont la sélection d'un thème
 * crée la clause à cet index (pas de thème par défaut — création explicite).
 */

import { MessageSquare } from "lucide-react";
import { useWorkspaceStore, selectSelectedDraft } from "@/store/workspace";
import type { LegalNature } from "@/types/contract";
import { secondaryCount } from "@/lib/validationDisplay";
import { ThemePalette } from "@/components/ui/ThemePalette";
import { NaturePicker } from "@/components/ui/NaturePicker";
import { CertaintyPicker } from "@/components/ui/CertaintyPicker";
import { ClauseChip } from "@/components/ui/ClauseChip";
import { Field } from "@/components/ui/primitives";
import { CommentThread } from "./CommentThread";
import { MultiLabelEditor } from "./MultiLabelEditor";
import { InspectorJudgeCompare } from "./InspectorJudgeCompare";

export function InspectorPanel({
  annotationId,
  documentId,
  projectSlug,
  themeCodes,
  legalNatures,
  themeFocusRef,
}: {
  annotationId: string;
  documentId?: string;
  projectSlug?: string;
  themeCodes: string[];
  legalNatures: LegalNature[];
  /** Permet au workspace de focaliser l'input de recherche de thème (touche B/T). */
  themeFocusRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const draft = useWorkspaceStore(selectSelectedDraft);
  const updateDraft = useWorkspaceStore((s) => s.updateDraft);
  const setCertainty = useWorkspaceStore((s) => s.setCertainty);
  const setValidated = useWorkspaceStore((s) => s.setValidated);
  const removeBoundary = useWorkspaceStore((s) => s.removeBoundary);
  const selectClause = useWorkspaceStore((s) => s.selectClause);
  const focusedSentence = useWorkspaceStore((s) => s.focusedSentence);
  const setBoundary = useWorkspaceStore((s) => s.setBoundary);
  const natureLabel = (code: string | null | undefined) =>
    code ? legalNatures.find((ln) => ln.code === code)?.label ?? code : null;

  // État « aucune clause sur la phrase focalisée » → proposer la création (Q2).
  if (!draft) {
    return (
      <div className="flex flex-col gap-3 p-4" data-testid="inspector">
        <p className="text-sm text-ink-muted" data-testid="inspector-no-clause">
          Phrase {focusedSentence} — aucune clause. Choisissez un thème pour créer une clause.
        </p>
        <ThemePalette
          value={null}
          themeCodes={themeCodes}
          autoFocus={false}
          onChange={(code) => {
            setBoundary(focusedSentence, code);
          }}
          focusRef={themeFocusRef}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="inspector">
      {/* En-tête (axe 3a) : identité de la clause + nature + VALIDER + supprimer,
          toujours visibles en haut de l'inspecteur. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ClauseChip
            themeCode={draft.theme}
            anchorIndex={draft.anchorIndex}
            selected
            validated={Boolean(draft.validated)}
            seededFrom={draft.seededFrom}
            resolvedFrom={draft.resolvedFrom}
            triageLevel={draft.triageLevel}
            secondaryCount={secondaryCount(draft.themes)}
          />
          {draft.legalNature && (
            <span
              data-testid="nature-badge"
              title={`Nature juridique : ${natureLabel(draft.legalNature)}`}
              className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-muted"
            >
              {natureLabel(draft.legalNature)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Validation explicite (point d) — accessible aussi depuis l'inspecteur. */}
          <button
            type="button"
            data-testid="inspector-validate"
            aria-pressed={draft.validated ?? false}
            onClick={() => setValidated(draft.localId, !(draft.validated ?? false))}
            className={
              "rounded-md border px-2 py-0.5 text-xs font-medium transition-colors " +
              ((draft.validated ?? false)
                ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                : "border-amber-400/50 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20")
            }
          >
            {(draft.validated ?? false) ? "✓ Validée" : "◷ Valider"}
          </button>
          <button
            type="button"
            data-testid="delete-clause"
            onClick={() => {
              removeBoundary(draft.anchorIndex);
              selectClause(null);
            }}
            className="text-xs text-red-400 hover:underline"
          >
            Supprimer
          </button>
        </div>
      </div>

      {draft.seededFrom && (
        <p
          className="rounded-md border border-dashed border-line bg-panel-muted px-2 py-1 text-[11px] text-ink-muted"
          data-testid="provenance"
        >
          Pré-rempli depuis <strong>{draft.seededFrom}</strong> — vérifiez et corrigez.
        </p>
      )}

      <Field label="Thème (vocab fermé)">
        {/* Axe 3a : tous les thèmes visibles (grille) + info-bulle explicative au survol. */}
        <ThemePalette
          value={draft.theme}
          themeCodes={themeCodes}
          layout="grid"
          describeOnHover
          onChange={(code) => {
            // D1 — toggle : re-cliquer le thème DÉJÀ posé désannote la phrase ; sinon
            // re-thématise. Cohérent avec le toggle du menu clic-droit (C3).
            if (code === draft.theme) {
              removeBoundary(draft.anchorIndex);
              selectClause(null);
            } else {
              updateDraft(draft.localId, { theme: code });
            }
          }}
          focusRef={themeFocusRef}
        />
      </Field>

      {/* Multi-label : toggle Mono/Multi + secondaires + ajout hors C3 (dossier UX). */}
      <MultiLabelEditor draft={draft} themeCodes={themeCodes} />

      <Field label="Nature juridique">
        {/* Axe 2 : pastilles cohérentes (toutes visibles) + définition au survol,
            à la place du <select> natif. data-testid legal-nature conservé pour les tests. */}
        <div data-testid="legal-nature">
          <NaturePicker
            value={draft.legalNature}
            legalNatures={legalNatures}
            onChange={(code) => updateDraft(draft.localId, { legalNature: code })}
            describeOnHover
          />
        </div>
      </Field>

      <Field label="Certitude (0–3)">
        <CertaintyPicker
          value={draft.certainty}
          onChange={(v) => setCertainty(draft.localId, v)}
        />
      </Field>

      <Field label="Evidence span" htmlFor="evidence">
        <input
          id="evidence"
          data-testid="evidence-span"
          value={draft.evidenceSpan}
          onChange={(e) => updateDraft(draft.localId, { evidenceSpan: e.target.value })}
          placeholder="Citation textuelle justifiant la clause"
          className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm text-ink"
        />
      </Field>

      <Field label="Rationale" htmlFor="rationale">
        <textarea
          id="rationale"
          data-testid="rationale"
          value={draft.rationale}
          onChange={(e) => updateDraft(draft.localId, { rationale: e.target.value })}
          rows={3}
          placeholder="Pourquoi ce thème ?"
          className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm text-ink"
        />
      </Field>

      <InspectorJudgeCompare
        documentId={documentId}
        projectSlug={projectSlug}
        anchorIndex={draft.anchorIndex}
        draftLocalId={draft.localId}
        humanEvidence={draft.evidenceSpan}
        humanRationale={draft.rationale}
      />

      {/* Axe 3d : commentaires rendus VISIBLES (section encadrée, pas un bas de page
          discret) — la collaboration est un citoyen de 1re classe de l'inspecteur. */}
      <div className="rounded-md border border-line bg-panel-muted/30 p-2" data-testid="inspector-comments">
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          <MessageSquare size={13} aria-hidden /> Commentaires &amp; discussion
        </h3>
        <CommentThread annotationId={annotationId} clauseId={draft.serverId} />
      </div>
    </div>
  );
}
