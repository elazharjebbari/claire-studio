/**
 * Résilience de l'autosave : terminal (401/403, 4xx), transitoire BORNÉ (5xx/réseau)
 * avec backoff + plafond, et réessai MANUEL. Évite la tempête réseau.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

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
  useAutosaveStore.setState({ saveState: "idle", lastSavedAt: null, manualRetry: 0 });
  mockAdd.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Arme un brouillon « à créer » et rend le hook. */
function armDraft(annId: string) {
  useWorkspaceStore.getState().init({ annotationId: annId, nSentences: 5, clauses: [] });
  const view = renderHook(() => useAutosave(annId));
  act(() => {
    useWorkspaceStore.getState().setBoundary(0, "META");
  });
  return view;
}

describe("useAutosave — résilience réseau", () => {
  it("401/403 → terminal, un seul appel, état unauthorized (non-régression L0)", async () => {
    mockAdd.mockRejectedValue(new ApiError(403, "Forbidden"));
    armDraft("a1");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(useAutosaveStore.getState().saveState).toBe("unauthorized");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it("4xx (400) → terminal, un seul appel, état error, AUCUN réessai", async () => {
    mockAdd.mockRejectedValue(new ApiError(400, "Bad Request"));
    armDraft("a2");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(useAutosaveStore.getState().saveState).toBe("error");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it("5xx → réessais BORNÉS (backoff), s'arrête après MAX et n'inonde pas", async () => {
    mockAdd.mockRejectedValue(new ApiError(500, "Server"));
    armDraft("a3");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300000);
    });
    const n = mockAdd.mock.calls.length;
    expect(n).toBeGreaterThan(1); // a bien réessayé
    expect(n).toBeLessThanOrEqual(6); // MAX_ATTEMPTS (5) + tentative initiale
    expect(useAutosaveStore.getState().saveState).toBe("error");
    // Stable : plus aucun appel ensuite (pas de boucle infinie).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300000);
    });
    expect(mockAdd.mock.calls.length).toBe(n);
  });

  it("réessai MANUEL relance après abandon (et réussit)", async () => {
    mockAdd.mockRejectedValue(new ApiError(500, "Server"));
    armDraft("a4");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300000);
    });
    const afterExhaust = mockAdd.mock.calls.length;
    expect(useAutosaveStore.getState().saveState).toBe("error");

    // Le serveur revient : le prochain essai réussit.
    mockAdd.mockResolvedValue({ id: "c1", anchorIndex: 0, theme: "META", order: 0 });
    await act(async () => {
      useAutosaveStore.getState().triggerRetry();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(mockAdd.mock.calls.length).toBeGreaterThan(afterExhaust);
    expect(useAutosaveStore.getState().saveState).toBe("saved");
  });
});
