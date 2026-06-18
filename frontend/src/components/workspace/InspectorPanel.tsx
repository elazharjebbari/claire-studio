"use client";

/**
 * Panneau droit — Inspecteur de la clause sélectionnée (navigation.md §3) :
 * thème (ThemePalette), nature juridique, certitude 0–3, evidence span, rationale,
 * commentaires (F9), provenance/diff LLM. Édite le brouillon local (store).
 */

import { useWorkspaceStore, selectSelectedDraft } from "@/store/workspace";
import type { LegalNature } from "@/types/contract";
import { ThemePalette } from "@/components/ui/ThemePalette";
import { CertaintyPicker } from "@/components/ui/CertaintyPicker";
import { ClauseChip } from "@/components/ui/ClauseChip";
import { Field } from "@/components/ui/primitives";
import { CommentThread } from "./CommentThread";

export function InspectorPanel({
  annotationId,
  themeCodes,
  legalNatures,
}: {
  annotationId: string;
  themeCodes: string[];
  legalNatures: LegalNature[];
}) {
  const draft = useWorkspaceStore(selectSelectedDraft);
  const updateDraft = useWorkspaceStore((s) => s.updateDraft);
  const setCertainty = useWorkspaceStore((s) => s.setCertainty);
  const removeBoundary = useWorkspaceStore((s) => s.removeBoundary);
  const selectClause = useWorkspaceStore((s) => s.selectClause);

  if (!draft) {
    return (
      <div className="p-4 text-sm text-ink-muted">
        Sélectionnez une clause dans le plan ou posez une ancre dans le document.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="inspector">
      <div className="flex items-center justify-between">
        <ClauseChip themeCode={draft.theme} anchorIndex={draft.anchorIndex} selected />
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

      {draft.seededFrom && (
        <p
          className="rounded-md border border-dashed border-line bg-panel-muted px-2 py-1 text-[11px] text-ink-muted"
          data-testid="provenance"
        >
          Pré-rempli depuis <strong>{draft.seededFrom}</strong> — vérifiez et corrigez.
        </p>
      )}

      <Field label="Thème (vocab fermé)">
        <ThemePalette
          value={draft.theme}
          themeCodes={themeCodes}
          onChange={(code) => updateDraft(draft.localId, { theme: code })}
        />
      </Field>

      <Field label="Nature juridique" htmlFor="legal-nature">
        <select
          id="legal-nature"
          data-testid="legal-nature"
          value={draft.legalNature ?? ""}
          onChange={(e) =>
            updateDraft(draft.localId, { legalNature: e.target.value || null })
          }
          className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm text-ink"
        >
          <option value="">— aucune —</option>
          {legalNatures.map((ln) => (
            <option key={ln.code} value={ln.code}>
              {ln.label}
            </option>
          ))}
        </select>
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

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Commentaires
        </h3>
        <CommentThread annotationId={annotationId} clauseId={draft.serverId} />
      </div>
    </div>
  );
}
