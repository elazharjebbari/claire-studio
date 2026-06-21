/**
 * Correctifs UI/UX : fusion des frontières (coalesceRuns) + adoption d'un SEGMENT
 * entier d'un juge (resolveDivergenceRange, validé sur toutes les phrases).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { coalesceRuns, computeRuns, type Run } from "@/lib/runs";
import { useWorkspaceStore } from "@/store/workspace";

describe("coalesceRuns (Fix D — fusion des segments de même thème)", () => {
  it("fusionne des runs adjacents de même thème (cas Mistral)", () => {
    // 4 ancres consécutives de même thème → un seul segment.
    const runs = computeRuns(
      [
        { anchorIndex: 0, theme: "LICENSE_IP", localId: "a" },
        { anchorIndex: 2, theme: "LICENSE_IP", localId: "b" },
        { anchorIndex: 4, theme: "LICENSE_IP", localId: "c" },
      ],
      6,
    );
    const merged = coalesceRuns(runs);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ start: 0, end: 5, theme: "LICENSE_IP" });
  });

  it("ne fusionne pas des thèmes différents", () => {
    const runs: Run[] = [
      { start: 0, end: 1, theme: "A", localId: "a" },
      { start: 2, end: 3, theme: "B", localId: "b" },
      { start: 4, end: 5, theme: "A", localId: "c" },
    ];
    expect(coalesceRuns(runs)).toHaveLength(3);
  });
});

describe("resolveDivergenceRange (Fix B — adoption de toute la frontière)", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    useWorkspaceStore.getState().init({ annotationId: "a1", nSentences: 8, clauses: [] });
  });

  it("crée une clause VALIDÉE resolvedFrom pour CHAQUE phrase du segment", () => {
    useWorkspaceStore.getState().resolveDivergenceRange(2, 5, "claude", "TERMINATION");
    const drafts = useWorkspaceStore.getState().draftClauses;
    for (let i = 2; i <= 5; i += 1) {
      const d = drafts.find((c) => c.anchorIndex === i);
      expect(d, `phrase ${i}`).toBeTruthy();
      expect(d?.theme).toBe("TERMINATION");
      expect(d?.resolvedFrom).toBe("claude");
      expect(d?.validated).toBe(true);
    }
    // Hors segment : rien.
    expect(drafts.find((c) => c.anchorIndex === 1)).toBeUndefined();
    expect(drafts.find((c) => c.anchorIndex === 6)).toBeUndefined();
  });

  it("est annulable en UN coup (un seul snapshot d'undo)", () => {
    useWorkspaceStore.getState().resolveDivergenceRange(0, 3, "mistral", "META");
    expect(useWorkspaceStore.getState().draftClauses).toHaveLength(4);
    useWorkspaceStore.getState().undo();
    expect(useWorkspaceStore.getState().draftClauses).toHaveLength(0);
  });
});
