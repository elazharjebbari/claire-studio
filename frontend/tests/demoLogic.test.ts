/**
 * Reviewer demo — pure logic: English labels cover the frozen specification, input guards,
 * thematic segments, disagreements, exports without CLAUDETTE text.
 */
import { describe, expect, it } from "vitest";

import spec from "@/lib/taxonomy/taxonomies.json";
import { T11_EN, T20_EN, themeLabelEn } from "@/lib/taxonomy/labels.en";
import type { DemoComparison, DemoPrediction, DemoResult } from "@/lib/api/demo";
import {
  comparisonRows,
  englishShare,
  estimateSentences,
  inputProblem,
  isDisagreement,
  labelCounts,
  segments,
  toCsvExport,
  toJsonExport,
} from "@/features/demo/logic";

type Spec = { taxonomies: Array<{ id: string; categories: Array<{ code: string }> }> };

describe("English labels", () => {
  it("cover every code of the frozen specification (T20 and T11)", () => {
    const taxonomies = (spec as Spec).taxonomies;
    const t20 = taxonomies.find((t) => t.id === "T20")!.categories.map((c) => c.code);
    const t11 = taxonomies.find((t) => t.id === "T11")!.categories.map((c) => c.code);
    expect(t20.filter((c) => !T20_EN[c])).toEqual([]);
    expect(t11.filter((c) => !T11_EN[c])).toEqual([]);
    expect(themeLabelEn("TERMINATION")).toBe("Termination");
    expect(themeLabelEn("FRAMEWORK")).toMatch(/framework/i);
    expect(themeLabelEn("UNKNOWN_CODE")).toBe("UNKNOWN_CODE");
  });
});

describe("input guards", () => {
  it("detect English and reject other languages", () => {
    expect(englishShare("the terms of the service and your account with us")).toBeGreaterThan(0.3);
    expect(inputProblem("Ceci est un contrat rédigé en français pour vérifier la détection de langue.")).toBe("not_english");
    expect(inputProblem("")).toBe("empty");
    expect(inputProblem("the ".repeat(20000))).toBe("too_long");
    expect(inputProblem("We may terminate your account at any time. All fees are due within thirty days.")).toBeNull();
  });

  it("estimate sentences by punctuation and lines", () => {
    expect(estimateSentences("")).toBe(0);
    expect(estimateSentences("One sentence. Another one! A third?")).toBe(3);
    expect(estimateSentences("4. Payment\nAll charges are non refundable.")).toBe(2);
  });
});

const PRED: DemoPrediction[] = [
  { index: 0, text: "a", label: "FRAMEWORK", confidence: 0.9, scores: {} },
  { index: 1, text: "b", label: "FRAMEWORK", confidence: 0.8, scores: {} },
  { index: 2, text: "c", label: "TERMINATION", confidence: 0.7, scores: {} },
  { index: 3, text: "d", label: "FEES_PAYMENT", confidence: 0.6, scores: {} },
  { index: 4, text: "e", label: "FEES_PAYMENT", confidence: 0.5, scores: {} },
];

describe("segments and legend", () => {
  it("cut a segment at every change of predicted theme", () => {
    expect(segments(PRED)).toEqual([
      { label: "FRAMEWORK", start: 0, end: 1, count: 2 },
      { label: "TERMINATION", start: 2, end: 2, count: 1 },
      { label: "FEES_PAYMENT", start: 3, end: 4, count: 2 },
    ]);
    expect(labelCounts(PRED)[0]).toEqual({ label: "FRAMEWORK", count: 2 });
  });
});

const COMPARISON: DemoComparison = {
  gold: [
    { index: 0, primaryT20: "PREAMBLE_SCOPE", primaryT11: "FRAMEWORK", agreementClass: "strict", tier: "auto_1click", secondaries: [] },
    { index: 2, primaryT20: "TERMINATION", primaryT11: "TERMINATION", agreementClass: "majority", tier: "auto", secondaries: [] },
    { index: 3, primaryT20: "LICENSE_IP", primaryT11: "CONTENT_IP", agreementClass: "strict", tier: "auto_1click", secondaries: [] },
  ],
  votes: [
    { index: 0, A1: "PREAMBLE_SCOPE", A2: "PREAMBLE_SCOPE", A3: "PREAMBLE_SCOPE" },
    { index: 2, A1: "TERMINATION", A2: "TERMINATION", A3: "ACCEPTABLE_USE" },
    { index: 3, A1: "LICENSE_IP", A2: "LICENSE_IP", A3: "LICENSE_IP" },
  ],
  judges: [{ index: 0, fable: "META", claude: "PREAMBLE_SCOPE" }],
  summary: { nSentences: 3, accuracyT11: 0.67, kappaT11: 0.5, judgesAccuracyT11: { fable: 1, claude: 1 } },
  judgesLegend: { fable: "Claude Fable 5", claude: "Claude Opus 4.7" },
};

describe("comparison", () => {
  it("projects the reference into T11 and keeps T20 on demand", () => {
    const rows11 = comparisonRows(COMPARISON, "T11", ["fable", "claude"]);
    expect(rows11.get(0)!.gold).toBe("FRAMEWORK");
    expect(rows11.get(0)!.judges.fable).toBe("FRAMEWORK"); // META → FRAMEWORK
    expect(rows11.get(2)!.votes.A3).toBe("ACCOUNT_USE");
    const rows20 = comparisonRows(COMPARISON, "T20", ["fable", "claude"]);
    expect(rows20.get(0)!.gold).toBe("PREAMBLE_SCOPE");
    expect(rows20.get(0)!.judges.fable).toBe("META");
  });

  it("flags disagreements: model ≠ gold, or split annotators", () => {
    const rows = comparisonRows(COMPARISON, "T11", ["fable"]);
    expect(isDisagreement(PRED[0]!, rows.get(0), "T11")).toBe(false);
    expect(isDisagreement(PRED[2]!, rows.get(2), "T11")).toBe(true); // annotators split
    expect(isDisagreement(PRED[3]!, rows.get(3), "T11")).toBe(true); // model FEES ≠ gold CONTENT_IP
    expect(isDisagreement(PRED[4]!, undefined, "T11")).toBe(false);
  });
});

describe("exports", () => {
  const result: DemoResult = { segmenter: "pysbd", classes: [], sentences: PRED, truncated: false, comparison: COMPARISON };

  it("omit the text for a CLAUDETTE contract and say so", () => {
    const json = JSON.parse(toJsonExport(result, { includeText: false, title: "Headspace" }));
    expect(json.textIncluded).toBe(false);
    expect(json.note).toMatch(/omitted/);
    expect(json.sentences[0]).not.toHaveProperty("text");
    expect(json.sentences[0].goldT11).toBe("FRAMEWORK");
    const csv = toCsvExport(result, { includeText: false, title: "Headspace" });
    expect(csv.split("\n")[0]).toBe("index,predicted,confidence,goldT20,goldT11");
    expect(csv).not.toContain(",a,");
  });

  it("keep the text for the visitor's own paste", () => {
    const json = JSON.parse(toJsonExport({ ...result, comparison: null }, { includeText: true, title: "Pasted text" }));
    expect(json.sentences[0].text).toBe("a");
    expect(json.sentences[0]).not.toHaveProperty("goldT11");
  });
});
