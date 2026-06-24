/**
 * Garde-fou ANTI-PERTE à la soumission (course autosave/submit). La soumission ne
 * transporte PAS les clauses : elle fige un snapshot côté serveur à partir de ce qui
 * est DÉJÀ persisté. `flush()` (appelé par confirmSubmit) doit donc forcer la
 * synchronisation et n'indiquer « convergé » que lorsque AUCUN changement local ne
 * reste en attente — sinon une modif récente serait perdue du snapshot soumis.
 *
 * Timers RÉELS ici (le flush s'appuie sur de petites pauses bornées).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/api/endpoints", () => ({
  addClause: vi.fn(),
  patchClause: vi.fn(),
  deleteClause: vi.fn(),
}));

import { addClause, patchClause } from "@/lib/api/endpoints";
import { useAutosave } from "@/components/workspace/useAutosave";
import { useWorkspaceStore } from "@/store/workspace";
import { useAutosaveStore } from "@/store/autosave";
import { ApiError } from "@/lib/api/client";
import type { Clause as ClauseType } from "@/types/contract";

const mockAdd = addClause as unknown as ReturnType<typeof vi.fn>;
const mockPatch = patchClause as unknown as ReturnType<typeof vi.fn>;

// Échoe le payload → persistedRef colle au brouillon, pas de faux diff résiduel.
function echoAdd(_annId: string, body: Record<string, unknown>) {
  return Promise.resolve({ id: "srv-" + body.anchorIndex, ...body });
}

beforeEach(() => {
  useWorkspaceStore.getState().reset();
  useAutosaveStore.setState({
    saveState: "idle",
    lastSavedAt: null,
    manualRetry: 0,
    flush: null,
  });
  mockAdd.mockReset();
  mockPatch.mockReset();
  mockAdd.mockImplementation(echoAdd);
  mockPatch.mockImplementation((id: string, body: Record<string, unknown>) =>
    Promise.resolve({ id, ...body }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("flush avant soumission — zéro donnée manquante", () => {
  it("persiste une modif récente PAS encore débouncée et renvoie convergé", async () => {
    useWorkspaceStore.getState().init({ annotationId: "f1", nSentences: 5, clauses: [] });
    renderHook(() => useAutosave("f1"));

    // Modif juste avant de soumettre : le débounce (1200 ms) n'a pas tiré.
    act(() => {
      useWorkspaceStore.getState().setBoundary(0, "META");
    });
    expect(mockAdd).not.toHaveBeenCalled(); // rien n'est encore parti au serveur

    let result: { converged: boolean; state: string } | undefined;
    await act(async () => {
      result = await useAutosaveStore.getState().flush!();
    });

    expect(mockAdd).toHaveBeenCalledTimes(1); // le flush a forcé la persistance
    expect(result!.converged).toBe(true); // tout est sur le serveur → submit autorisé
  });

  it("renvoie NON convergé si la persistance échoue (terminal) → submit s'abstient", async () => {
    mockAdd.mockReset();
    mockAdd.mockRejectedValue(new ApiError(400, "Bad Request"));
    useWorkspaceStore.getState().init({ annotationId: "f2", nSentences: 5, clauses: [] });
    renderHook(() => useAutosave("f2"));
    act(() => {
      useWorkspaceStore.getState().setBoundary(0, "META");
    });

    let result: { converged: boolean; state: string } | undefined;
    await act(async () => {
      result = await useAutosaveStore.getState().flush!();
    });

    // La clause n'a jamais atteint le serveur → on NE doit PAS laisser soumettre.
    expect(result!.converged).toBe(false);
  });

  it("flush sans changement en attente → convergé, aucun appel réseau", async () => {
    useWorkspaceStore.getState().init({ annotationId: "f3", nSentences: 5, clauses: [] });
    renderHook(() => useAutosave("f3"));

    let result: { converged: boolean; state: string } | undefined;
    await act(async () => {
      result = await useAutosaveStore.getState().flush!();
    });

    expect(mockAdd).not.toHaveBeenCalled();
    expect(result!.converged).toBe(true);
  });

  it("CONVERGE malgré un champ dérivé normalisé par le serveur (anti-boucle Atlas)", async () => {
    // Régression du bug « modifications pas encore enregistrées » sur Atlas : le serveur
    // NORMALISE le support multi-label (renvoie 0 ≠ ce que le brouillon porte) → sans
    // réconciliation, planClauseSync diffèrerait à perpétuité (re-PATCH en boucle, 200).
    // Le serveur renvoie TOUJOURS support=0 quoi qu'on envoie.
    mockPatch.mockReset();
    mockPatch.mockImplementation((id: string, body: Record<string, unknown>) =>
      Promise.resolve({
        id,
        ...body,
        themes: [
          { label: "TERMINATION", role: "primary", support: 0 },
          { label: "META", role: "secondary", support: 0 },
        ],
      }),
    );
    // Clause persistée AVEC un support non trivial (2) — divergera de la réponse (0).
    const clause = {
      id: "c-1", annotationId: "f4", anchorIndex: 0, theme: "TERMINATION",
      themes: [
        { label: "TERMINATION", role: "primary", support: 2 },
        { label: "META", role: "secondary", support: 2 },
      ],
      boundary: { type: "soft", support: 1 }, triageLevel: "C3",
      legalNature: null, evidenceSpan: "x", rationale: "y", certainty: 1,
      validated: true, order: 0,
    } as unknown as ClauseType;
    useWorkspaceStore.getState().init({ annotationId: "f4", nSentences: 5, clauses: [clause] });
    renderHook(() => useAutosave("f4"));

    // Édition qui force un UPDATE (la certitude change) → déclenche la synchro.
    act(() => {
      useWorkspaceStore.getState().setCertainty("c-1", 3);
    });

    let result: { converged: boolean; state: string } | undefined;
    await act(async () => {
      result = await useAutosaveStore.getState().flush!();
    });

    // Sans réconciliation, le flush ferait FLUSH_MAX_PASSES et renverrait converged=false.
    expect(result!.converged).toBe(true);
    // Le brouillon a été aligné sur la vérité serveur (support 0).
    const c = useWorkspaceStore.getState().draftClauses.find((d) => d.localId === "c-1");
    expect(c?.themes?.every((t) => t.support === 0)).toBe(true);
  });
});
