/**
 * Helpers PURS du cockpit GOLD : agrégats + stylisation (anti-hex).
 */
import { describe, expect, it } from "vitest";
import { summarize } from "@/lib/gold/cockpit";
import {
  STATUS_META,
  AGREEMENT_META,
  RISK_META,
  AUTO_META,
  progressBarClass,
} from "@/lib/gold/styling";
import type { GoldDocumentRow } from "@/lib/gold/types";

const row = (over: Partial<GoldDocumentRow>): GoldDocumentRow => ({
  document: { id: 1, externalId: "D", title: "D", nSentences: 10 },
  status: "unresolved",
  pctResolved: 0,
  locked: false,
  lockedBy: null,
  counts: {},
  arbiters: [],
  ...over,
});

describe("summarize (cockpit)", () => {
  it("compte les statuts et l'avancement global pondéré par les phrases", () => {
    const s = summarize([
      row({ status: "resolved", document: { id: 1, externalId: "A", title: "A", nSentences: 4 }, counts: { decided: 4 } }),
      row({ status: "in_progress", document: { id: 2, externalId: "B", title: "B", nSentences: 6 }, counts: { decided: 3, highRisk: 2 } }),
      row({ status: "unresolved", document: { id: 3, externalId: "C", title: "C", nSentences: 5 }, counts: {} }),
    ]);
    expect(s.total).toBe(3);
    expect(s.resolved).toBe(1);
    expect(s.inProgress).toBe(1);
    expect(s.unresolved).toBe(1);
    expect(s.sentencesTotal).toBe(15);
    expect(s.sentencesDecided).toBe(7);
    expect(s.pctOverall).toBeCloseTo(7 / 15);
    expect(s.highRisk).toBe(2);
  });

  it("liste vide → tout à zéro, pas de division par zéro", () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.pctOverall).toBe(0);
  });
});

describe("styling GOLD (tokens sémantiques, zéro hex)", () => {
  const metas = [
    ...Object.values(STATUS_META),
    ...Object.values(AGREEMENT_META),
    ...Object.values(RISK_META),
    ...Object.values(AUTO_META),
  ];

  it("aucune classe ne contient de hex en dur", () => {
    for (const m of metas) {
      expect(m.cls).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      expect(m.label.length).toBeGreaterThan(0);
    }
  });

  it("les métas couvrent toutes les valeurs des unions du moteur", () => {
    expect(Object.keys(AGREEMENT_META).sort()).toEqual(["divergence", "empty", "majority", "strict"]);
    expect(Object.keys(RISK_META).sort()).toEqual(["high", "low", "medium"]);
    expect(Object.keys(AUTO_META).sort()).toEqual(["auto", "auto_1click", "manual"]);
  });

  it("la barre de progression mappe sur un token selon l'avancement", () => {
    expect(progressBarClass(1)).toBe("bg-success");
    expect(progressBarClass(0.5)).toBe("bg-warning");
    expect(progressBarClass(0)).toBe("bg-line");
  });
});
