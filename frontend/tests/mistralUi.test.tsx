/**
 * Vague 1 — complétion UI Mistral (points a, b, c).
 *  (b) LlmSourceSwitch propose Mistral en plus de Humain/Claude/Codex/Comparer.
 *  (a) L'adoption d'un juge (resolveDivergence) est générique → fonctionne pour Mistral.
 *  (c) Le libellé de provenance se généralise à Mistral (llmJudgeLabel).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LlmSourceSwitch } from "@/components/workspace/LlmSourceSwitch";
import { useWorkspaceStore } from "@/store/workspace";
import { llmJudgeLabel } from "@/lib/llmJudges";

beforeEach(() => {
  useWorkspaceStore.getState().reset();
});
afterEach(() => cleanup());

describe("UI Mistral — Vague 1", () => {
  it("(b) le switch source propose Humain, Claude, Codex, Mistral et Comparer", () => {
    render(<LlmSourceSwitch />);
    for (const id of ["llm-human", "llm-claude", "llm-codex", "llm-mistral", "llm-compare"]) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
  });

  it("(b) cliquer Mistral règle la source sur 'mistral'", () => {
    render(<LlmSourceSwitch />);
    fireEvent.click(screen.getByTestId("llm-mistral"));
    expect(useWorkspaceStore.getState().llmSource).toBe("mistral");
  });

  it("(a) adopter Mistral crée une clause arbitrée (resolvedFrom='mistral')", () => {
    useWorkspaceStore.getState().init({ annotationId: "a1", nSentences: 10, clauses: [] });
    useWorkspaceStore.getState().resolveDivergence(4, "mistral", "TERMINATION");
    const d = useWorkspaceStore.getState().draftClauses.find((c) => c.anchorIndex === 4);
    expect(d?.theme).toBe("TERMINATION");
    expect(d?.resolvedFrom).toBe("mistral");
  });

  it("(c) le libellé de provenance se généralise à Mistral", () => {
    expect(llmJudgeLabel("mistral")).toBe("Mistral");
    expect(llmJudgeLabel("claude")).toBe("Claude");
    expect(llmJudgeLabel("codex")).toBe("Codex");
  });
});
