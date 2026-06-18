/**
 * Parsing & normalisation du format pivot « clause » (CONTRACT §4).
 *
 * Le pivot est le format d'échange interne et d'export. Il est compatible avec les
 * pré-annotations LLM existantes :
 *   - v9.4 : plan.clauses[].anchor_id → anchor_index ; open_span → evidence_span
 *   - v9.2 : document_plan.segments[].start_id → anchor_index
 *
 * Cette fonction normalise n'importe laquelle de ces formes vers `PivotClause[]`.
 * Elle est testée unitairement (tests/pivot.test.ts) : c'est une brique critique.
 */

import type {
  Annotation,
  Certainty,
  Clause,
  PivotClause,
  PivotClauseDocument,
  PreClause,
} from "@/types/contract";

/** Forme brute v9.4 (extrait). */
interface RawV94 {
  plan?: {
    clauses?: Array<{
      anchor_id?: number;
      theme?: string;
      legal_nature?: string | null;
      open_span?: string;
      rationale?: string;
      certainty?: number;
    }>;
  };
}

/** Forme brute v9.2 (extrait). */
interface RawV92 {
  document_plan?: {
    segments?: Array<{
      start_id?: number;
      theme?: string;
      span?: string;
      rationale?: string;
    }>;
  };
}

function clampCertainty(value: unknown): Certainty {
  const n = typeof value === "number" ? Math.round(value) : 0;
  if (n <= 0) return 0;
  if (n >= 3) return 3;
  return n as Certainty;
}

/**
 * Normalise une charge brute (v9.2, v9.4 ou pivot natif) vers `PivotClause[]`.
 * Renvoie un tableau trié par `anchor_index` croissant (segmentation monotone).
 */
export function normalizeToPivotClauses(raw: unknown): PivotClause[] {
  if (raw == null || typeof raw !== "object") return [];

  const obj = raw as Record<string, unknown> & RawV94 & RawV92;
  let clauses: PivotClause[] = [];

  // Pivot natif : { clauses: [{ anchor_index, theme, ... }] }
  if (Array.isArray(obj.clauses)) {
    clauses = (obj.clauses as Array<Record<string, unknown>>).map((c) => ({
      anchor_index: Number(c.anchor_index ?? 0),
      theme: String(c.theme ?? "MISC_BOILERPLATE"),
      legal_nature: (c.legal_nature as string | null) ?? null,
      evidence_span: String(c.evidence_span ?? ""),
      rationale: String(c.rationale ?? ""),
      certainty: clampCertainty(c.certainty),
    }));
  } else if (obj.plan?.clauses) {
    // v9.4
    clauses = obj.plan.clauses.map((c) => ({
      anchor_index: Number(c.anchor_id ?? 0),
      theme: String(c.theme ?? "MISC_BOILERPLATE"),
      legal_nature: c.legal_nature ?? null,
      evidence_span: String(c.open_span ?? ""),
      rationale: String(c.rationale ?? ""),
      certainty: clampCertainty(c.certainty),
    }));
  } else if (obj.document_plan?.segments) {
    // v9.2
    clauses = obj.document_plan.segments.map((s) => ({
      anchor_index: Number(s.start_id ?? 0),
      theme: String(s.theme ?? "MISC_BOILERPLATE"),
      legal_nature: null,
      evidence_span: String(s.span ?? ""),
      rationale: String(s.rationale ?? ""),
      certainty: 0 as Certainty,
    }));
  }

  // Tri monotone par index d'ancre, déduplication d'ancres (1 seul start par phrase).
  const seen = new Set<number>();
  return clauses
    .sort((a, b) => a.anchor_index - b.anchor_index)
    .filter((c) => {
      if (seen.has(c.anchor_index)) return false;
      seen.add(c.anchor_index);
      return true;
    });
}

/** Convertit des `PreClause` (pré-annotation mappée) en `PivotClause`. */
export function preClausesToPivot(pre: PreClause[]): PivotClause[] {
  return normalizeToPivotClauses({
    clauses: pre.map((p) => ({
      anchor_index: p.anchorIndex,
      theme: p.themeCode,
      legal_nature: null,
      evidence_span: p.evidenceSpan ?? "",
      rationale: p.rationale ?? "",
      certainty: 0,
    })),
  });
}

/** Sérialise une `Annotation` complète vers le document pivot (export / snapshot). */
export function annotationToPivot(
  annotation: Annotation,
  meta: { doc: string; annotator: string; schema: string },
): PivotClauseDocument {
  return {
    doc: meta.doc,
    project: annotation.projectSlug,
    annotator: meta.annotator,
    schema: meta.schema,
    status: annotation.status,
    global_certainty: (annotation.globalCertainty ?? 0) as Certainty,
    clauses: annotation.clauses
      .slice()
      .sort((a, b) => a.anchorIndex - b.anchorIndex)
      .map((c) => ({
        anchor_index: c.anchorIndex,
        theme: c.theme,
        legal_nature: c.legalNature ?? null,
        evidence_span: c.evidenceSpan ?? "",
        rationale: c.rationale ?? "",
        certainty: (c.certainty ?? 0) as Certainty,
      })),
    provenance: {
      seeded_from: annotation.clauses.find((c) => c.seededFrom)?.seededFrom ?? undefined,
      edited: annotation.source === "human",
    },
  };
}

/**
 * Calcule, pour chaque phrase, à quelle clause elle appartient (segmentation
 * monotone dérivée des ancres). Renvoie un Map<sentenceIndex, clauseId>.
 */
export function segmentByAnchors(clauses: Clause[], nSentences: number): Map<number, string> {
  const map = new Map<number, string>();
  const sorted = clauses.slice().sort((a, b) => a.anchorIndex - b.anchorIndex);
  if (sorted.length === 0) return map;
  for (let s = 0; s < nSentences; s += 1) {
    // La clause active est la dernière dont l'ancre est <= s.
    let active = sorted[0];
    for (const c of sorted) {
      if (c.anchorIndex <= s) active = c;
      else break;
    }
    if (active && active.anchorIndex <= s) map.set(s, active.id);
  }
  return map;
}
