import { describe, expect, it } from "vitest";
import {
  annotationToPivot,
  normalizeToPivotClauses,
  preClausesToPivot,
  segmentByAnchors,
} from "@/lib/pivot";
import type { Annotation, Clause } from "@/types/contract";

describe("normalizeToPivotClauses", () => {
  it("normalise le format v9.4 (anchor_id, open_span)", () => {
    const raw = {
      plan: {
        clauses: [
          { anchor_id: 6, theme: "TERMINATION", open_span: "fitbit ...", rationale: "r", certainty: 2 },
          { anchor_id: 0, theme: "META", open_span: "title", rationale: "t", certainty: 5 },
        ],
      },
    };
    const out = normalizeToPivotClauses(raw);
    expect(out).toHaveLength(2);
    // Tri monotone par anchor_index.
    expect(out[0]!.anchor_index).toBe(0);
    expect(out[1]!.anchor_index).toBe(6);
    // open_span → evidence_span ; certitude clampée à 3.
    expect(out[1]!.evidence_span).toBe("fitbit ...");
    expect(out[0]!.certainty).toBe(3);
  });

  it("normalise le format v9.2 (document_plan.segments.start_id)", () => {
    const raw = {
      document_plan: {
        segments: [
          { start_id: 2, theme: "PREAMBLE_SCOPE", span: "scope" },
          { start_id: 4, theme: "ELIGIBILITY_ACCOUNT", span: "age" },
        ],
      },
    };
    const out = normalizeToPivotClauses(raw);
    expect(out.map((c) => c.anchor_index)).toEqual([2, 4]);
    expect(out[0]!.certainty).toBe(0);
  });

  it("accepte le pivot natif et déduplique les ancres", () => {
    const raw = {
      clauses: [
        { anchor_index: 1, theme: "META" },
        { anchor_index: 1, theme: "PRIVACY_DATA" },
        { anchor_index: 0, theme: "PREAMBLE_SCOPE" },
      ],
    };
    const out = normalizeToPivotClauses(raw);
    expect(out).toHaveLength(2); // ancre 1 dédupliquée
    expect(out[0]!.anchor_index).toBe(0);
  });

  it("renvoie [] pour une entrée invalide", () => {
    expect(normalizeToPivotClauses(null)).toEqual([]);
    expect(normalizeToPivotClauses("nope")).toEqual([]);
  });
});

describe("preClausesToPivot", () => {
  it("convertit des PreClause en pivot trié", () => {
    const out = preClausesToPivot([
      { anchorIndex: 5, themeCode: "TERMINATION" },
      { anchorIndex: 0, themeCode: "META", evidenceSpan: "x" },
    ]);
    expect(out[0]!.anchor_index).toBe(0);
    expect(out[1]!.theme).toBe("TERMINATION");
  });
});

describe("annotationToPivot", () => {
  it("sérialise une annotation complète", () => {
    const annotation: Annotation = {
      id: "a",
      projectSlug: "p",
      documentId: "d",
      annotatorId: "u",
      status: "submitted",
      globalCertainty: 2,
      source: "human",
      createdAt: "",
      updatedAt: "",
      clauses: [
        { id: "c2", annotationId: "a", anchorIndex: 3, theme: "TERMINATION", order: 1 },
        { id: "c1", annotationId: "a", anchorIndex: 0, theme: "META", order: 0 },
      ],
    };
    const pivot = annotationToPivot(annotation, { doc: "Fitbit", annotator: "alice", schema: "v1" });
    expect(pivot.doc).toBe("Fitbit");
    expect(pivot.clauses[0]!.anchor_index).toBe(0);
    expect(pivot.global_certainty).toBe(2);
  });
});

describe("segmentByAnchors", () => {
  it("dérive une segmentation monotone des ancres", () => {
    const clauses: Clause[] = [
      { id: "c1", annotationId: "a", anchorIndex: 0, theme: "META", order: 0 },
      { id: "c2", annotationId: "a", anchorIndex: 3, theme: "TERMINATION", order: 1 },
    ];
    const seg = segmentByAnchors(clauses, 6);
    expect(seg.get(0)).toBe("c1");
    expect(seg.get(2)).toBe("c1");
    expect(seg.get(3)).toBe("c2");
    expect(seg.get(5)).toBe("c2");
  });
});
