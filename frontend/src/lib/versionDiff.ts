/**
 * Calcul du diff entre deux snapshots de versions d'annotation (CONTRACT §3 :
 * GET /annotations/{id}/versions/{n}/diff ; feature 3 — versioning/historique).
 *
 * La comparaison se fait clause par clause, identifiée par `anchor_index`
 * (segmentation monotone dérivée des ancres, comme le pivot §4). C'est une brique
 * pure et testable, indépendante de l'UI et du réseau.
 */

import type {
  ClauseDiff,
  DiffStatus,
  PivotClause,
  PivotClauseDocument,
  VersionDiff,
} from "@/types/contract";

/** Champs comparés pour détecter une clause « modifiée ». */
const COMPARED_FIELDS: Array<keyof PivotClause> = [
  "theme",
  "legal_nature",
  "evidence_span",
  "rationale",
  "certainty",
];

function changedFields(before: PivotClause, after: PivotClause): string[] {
  return COMPARED_FIELDS.filter((f) => before[f] !== after[f]).map((f) => String(f));
}

/**
 * Diffe deux documents pivot (snapshots de version) et renvoie, par ancre, le
 * statut de la clause (ajoutée / supprimée / modifiée / inchangée), trié par ancre.
 */
export function diffSnapshots(
  from: PivotClauseDocument,
  to: PivotClauseDocument,
): ClauseDiff[] {
  const fromByAnchor = new Map(from.clauses.map((c) => [c.anchor_index, c]));
  const toByAnchor = new Map(to.clauses.map((c) => [c.anchor_index, c]));
  const anchors = Array.from(
    new Set([...fromByAnchor.keys(), ...toByAnchor.keys()]),
  ).sort((a, b) => a - b);

  return anchors.map((anchorIndex) => {
    const before = fromByAnchor.get(anchorIndex) ?? null;
    const after = toByAnchor.get(anchorIndex) ?? null;

    let status: DiffStatus;
    let fields: string[] | undefined;
    if (before && !after) {
      status = "removed";
    } else if (!before && after) {
      status = "added";
    } else if (before && after) {
      fields = changedFields(before, after);
      status = fields.length > 0 ? "modified" : "unchanged";
    } else {
      status = "unchanged";
    }

    return { anchorIndex, status, before, after, changedFields: fields };
  });
}

/** Construit la réponse complète de diff (clauses + résumé) entre deux versions. */
export function buildVersionDiff(
  annotationId: string,
  from: { number: number; label?: string; snapshot: PivotClauseDocument },
  to: { number: number; label?: string; snapshot: PivotClauseDocument },
): VersionDiff {
  const clauses = diffSnapshots(from.snapshot, to.snapshot);
  const summary = { added: 0, removed: 0, modified: 0, unchanged: 0 };
  for (const c of clauses) summary[c.status] += 1;
  return {
    annotationId,
    from: { number: from.number, label: from.label },
    to: { number: to.number, label: to.label },
    clauses,
    summary,
  };
}
