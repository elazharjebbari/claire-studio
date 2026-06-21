/**
 * Vague 2 — point e : comparaison N-way (2 ou 3 juges).
 *  - agreementSegments généralisée : accord / conflit (≥2 thèmes) / partiel.
 *  - store.toggleCompareJudge : sélection 2–3 juges, minimum 2 conservé.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { agreementSegments } from "@/components/workspace/ComparePanel";
import { useWorkspaceStore } from "@/store/workspace";

describe("agreementSegments (N-way)", () => {
  it("3 juges d'accord → un segment 'agree'", () => {
    const segs = agreementSegments([
      ["A", "A", "A"],
      ["A", "A", "A"],
      ["A", "A", "A"],
    ], 3, 3);
    expect(segs).toEqual([{ start: 0, end: 2, status: "agree" }]);
  });

  it("≥2 thèmes distincts → 'diverge' (conflit)", () => {
    const segs = agreementSegments([
      ["A", "A"],
      ["A", "B"],
      ["A", "A"],
    ], 3, 2);
    expect(segs[0]).toEqual({ start: 0, end: 0, status: "agree" });
    expect(segs[1]).toEqual({ start: 1, end: 1, status: "diverge" });
  });

  it("couverture incomplète mais accord → 'partial'", () => {
    const segs = agreementSegments([
      ["A", "A"],
      ["A", null],
      ["A", "A"],
    ], 3, 2);
    expect(segs[0]).toEqual({ start: 0, end: 0, status: "agree" });
    expect(segs[1]).toEqual({ start: 1, end: 1, status: "partial" });
  });

  it("phrase couverte par personne → ignorée", () => {
    const segs = agreementSegments([
      [null, "A"],
      [null, "A"],
    ], 2, 2);
    expect(segs).toEqual([{ start: 1, end: 1, status: "agree" }]);
  });
});

describe("store.toggleCompareJudge", () => {
  beforeEach(() => useWorkspaceStore.getState().reset());

  it("défaut = claude + codex", () => {
    expect(useWorkspaceStore.getState().compareJudges).toEqual(["claude", "codex"]);
  });

  it("ajoute Mistral → 3 juges", () => {
    useWorkspaceStore.getState().toggleCompareJudge("mistral");
    expect(useWorkspaceStore.getState().compareJudges).toEqual(["claude", "codex", "mistral"]);
  });

  it("retire un juge quand il en reste 3", () => {
    useWorkspaceStore.getState().toggleCompareJudge("mistral"); // 3
    useWorkspaceStore.getState().toggleCompareJudge("codex"); // 2
    expect(useWorkspaceStore.getState().compareJudges).toEqual(["claude", "mistral"]);
  });

  it("refuse de descendre sous 2 juges", () => {
    useWorkspaceStore.getState().toggleCompareJudge("codex"); // tenterait 1 → refusé
    expect(useWorkspaceStore.getState().compareJudges).toEqual(["claude", "codex"]);
  });
});
