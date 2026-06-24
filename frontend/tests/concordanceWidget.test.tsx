/**
 * ConcordanceWidget (point 4) — pastille + carte de concordance temps réel dans l'atelier.
 * On mocke `useLlmAgreement` (pré-annotations) et on alimente le store local (clauses
 * humaines) pour vérifier le calcul réactif et le rendu.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/api/hooks", () => ({ useLlmAgreement: vi.fn() }));
import { useLlmAgreement } from "@/lib/api/hooks";
import { ConcordanceWidget } from "@/components/workspace/ConcordanceWidget";
import { useWorkspaceStore } from "@/store/workspace";

const mockAgreement = vi.mocked(useLlmAgreement);

function setJudges(preByJudge: Record<string, unknown>) {
  // Le widget ne lit que preByJudge ; le reste du retour est ignoré ici.
  mockAgreement.mockReturnValue({ preByJudge } as unknown as ReturnType<typeof useLlmAgreement>);
}

beforeEach(() => {
  useWorkspaceStore.getState().reset();
  mockAgreement.mockReset();
});
afterEach(cleanup);

describe("ConcordanceWidget", () => {
  it("ne rend rien sans juge pour le document", () => {
    setJudges({});
    act(() => useWorkspaceStore.getState().init({ annotationId: "a1", nSentences: 5, clauses: [] }));
    const { container } = render(<ConcordanceWidget documentId="d1" projectSlug="p1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("affiche le meilleur modèle + le détail (humain↔LLM et LLM↔LLM)", () => {
    setJudges({
      claude: { clauses: [{ anchorIndex: 0, themeCode: "META" }, { anchorIndex: 3, themeCode: "TERMINATION" }] },
      codex: { clauses: [{ anchorIndex: 0, themeCode: "META" }, { anchorIndex: 3, themeCode: "MISC_BOILERPLATE" }] },
    });
    act(() => {
      useWorkspaceStore.getState().init({ annotationId: "a1", nSentences: 5, clauses: [] });
      // Humain (exact) : phrase 0 = META, phrase 3 = TERMINATION.
      useWorkspaceStore.getState().setBoundary(0, "META");
      useWorkspaceStore.getState().setBoundary(3, "TERMINATION");
    });

    render(<ConcordanceWidget documentId="d1" projectSlug="p1" />);
    // Pastille : meilleur accord = Claude à 100%.
    const best = screen.getByTestId("concordance-best");
    expect(best).toHaveTextContent("Claude");
    expect(best).toHaveTextContent("100%");

    // Déplier la carte.
    fireEvent.click(screen.getByTestId("concordance-toggle"));
    expect(screen.getByTestId("concordance-card")).toBeInTheDocument();
    expect(screen.getByTestId("concordance-row-claude")).toHaveTextContent("100%");
    expect(screen.getByTestId("concordance-row-codex")).toHaveTextContent("50%");
    // Accord LLM↔LLM présent.
    expect(screen.getByTestId("concordance-llm-mean")).toBeInTheDocument();
    expect(screen.getByTestId("concordance-coverage")).toHaveTextContent("2/5");
  });

  it("invite à annoter quand aucune phrase n'est couverte", () => {
    setJudges({ claude: { clauses: [{ anchorIndex: 0, themeCode: "META" }] } });
    act(() => useWorkspaceStore.getState().init({ annotationId: "a1", nSentences: 5, clauses: [] }));
    render(<ConcordanceWidget documentId="d1" projectSlug="p1" />);
    fireEvent.click(screen.getByTestId("concordance-toggle"));
    expect(screen.getByTestId("concordance-empty")).toBeInTheDocument();
  });
});
