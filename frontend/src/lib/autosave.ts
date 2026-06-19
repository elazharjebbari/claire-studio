/**
 * Plan de synchronisation des clauses (chantier C — fiabilité de l'enregistrement).
 *
 * Fonction PURE (sans React ni réseau, testable isolément) qui compare le brouillon
 * local (draftClauses du store) à l'état déjà persité côté serveur, et produit la
 * liste minimale d'opérations à appliquer : créations / mises à jour / suppressions.
 *
 * Clé de rapprochement = `anchorIndex` : une ancre est unique par annotation
 * (INV-2) et stable pour une clause donnée (re-thématiser ne change pas l'ancre,
 * supprimer la retire, poser une frontière en ajoute une) — ce qui rend le diff
 * déterministe sans dépendre d'un mapping localId↔serverId fragile.
 */

import type { DraftClause } from "@/store/workspace";

export interface PersistedClause {
  anchorIndex: number;
  serverId: string;
  theme: string;
  legalNature: string | null;
  evidenceSpan: string;
  rationale: string;
  certainty: number | null;
}

export interface ClauseSyncPlan {
  creates: DraftClause[];
  updates: Array<{ serverId: string; draft: DraftClause }>;
  deletes: string[]; // serverIds
}

function sameFields(d: DraftClause, p: PersistedClause): boolean {
  return (
    d.theme === p.theme &&
    (d.legalNature ?? null) === p.legalNature &&
    (d.evidenceSpan ?? "") === p.evidenceSpan &&
    (d.rationale ?? "") === p.rationale &&
    (d.certainty ?? null) === p.certainty
  );
}

export function planClauseSync(
  draft: DraftClause[],
  persisted: PersistedClause[],
): ClauseSyncPlan {
  const persistedByAnchor = new Map(persisted.map((p) => [p.anchorIndex, p]));
  const draftAnchors = new Set(draft.map((d) => d.anchorIndex));

  const creates: DraftClause[] = [];
  const updates: Array<{ serverId: string; draft: DraftClause }> = [];
  for (const d of draft) {
    const p = persistedByAnchor.get(d.anchorIndex);
    if (!p) creates.push(d);
    else if (!sameFields(d, p)) updates.push({ serverId: p.serverId, draft: d });
  }

  const deletes: string[] = [];
  for (const p of persisted) {
    if (!draftAnchors.has(p.anchorIndex)) deletes.push(p.serverId);
  }

  return { creates, updates, deletes };
}

export function isEmptyPlan(plan: ClauseSyncPlan): boolean {
  return (
    plan.creates.length === 0 &&
    plan.updates.length === 0 &&
    plan.deletes.length === 0
  );
}

/** Convertit des DraftClause persistées (avec serverId) en snapshot de référence. */
export function draftsToPersisted(drafts: DraftClause[]): PersistedClause[] {
  return drafts
    .filter((d) => d.serverId)
    .map((d) => ({
      anchorIndex: d.anchorIndex,
      serverId: d.serverId as string,
      theme: d.theme,
      legalNature: d.legalNature ?? null,
      evidenceSpan: d.evidenceSpan ?? "",
      rationale: d.rationale ?? "",
      certainty: d.certainty ?? null,
    }));
}
