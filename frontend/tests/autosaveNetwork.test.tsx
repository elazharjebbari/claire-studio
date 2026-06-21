/**
 * L0 — durcissement autosave : pas de réessai sur erreurs TERMINALES (401/403),
 * réessai conservé sur transitoire (500). Évite la tempête réseau du bug 403.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock des endpoints appelés par l'autosave (avant import du hook).
vi.mock("@/lib/api/endpoints", () => ({
  addClause: vi.fn(),
  patchClause: vi.fn(),
  deleteClause: vi.fn(),
}));

import { addClause } from "@/lib/api/endpoints";
import { useAutosave } from "@/components/workspace/useAutosave";
import { useWorkspaceStore } from "@/store/workspace";
import { useAutosaveStore } from "@/store/autosave";
import { ApiError } from "@/lib/api/client";

const mockAdd = addClause as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  useWorkspaceStore.getState().reset();
  useAutosaveStore.setState({ saveState: "idle", lastSavedAt: null });
  mockAdd.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAutosave — erreurs terminales (L0)", () => {
  it("403 → un seul essai, état 'unauthorized', AUCUN réessai", async () => {
    mockAdd.mockRejectedValue(new ApiError(403, "Forbidden"));
    useWorkspaceStore.getState().init({ annotationId: "a1", nSentences: 5, clauses: [] });
    renderHook(() => useAutosave("a1"));

    act(() => {
      useWorkspaceStore.getState().setBoundary(0, "META");
    });
    // Débounce (1200 ms) → 1er essai.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(useAutosaveStore.getState().saveState).toBe("unauthorized");

    // Beaucoup de temps en plus → toujours un seul appel (pas de tempête).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it("500 → réessai (transitoire), pas d'état terminal", async () => {
    mockAdd.mockRejectedValue(new ApiError(500, "Server"));
    useWorkspaceStore.getState().init({ annotationId: "a2", nSentences: 5, clauses: [] });
    renderHook(() => useAutosave("a2"));

    act(() => {
      useWorkspaceStore.getState().setBoundary(0, "META");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });
    const first = mockAdd.mock.calls.length;
    expect(first).toBeGreaterThanOrEqual(1);
    expect(useAutosaveStore.getState().saveState).toBe("error");

    // Le temps passe → nouvelle tentative (convergence replanifiée).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });
    expect(mockAdd.mock.calls.length).toBeGreaterThan(first);
  });
});
