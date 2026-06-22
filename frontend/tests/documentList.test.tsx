/**
 * ADR-001 — anti-duplication des documents.
 *
 * Garde-fou direct du bug observé en prod : pour un admin, l'ancienne liste dérivée
 * des assignations affichait chaque document N fois (1 par annotateur). On vérifie :
 *  (1) le hook useProjectDocuments DÉDUPLIQUE par document (défense en profondeur,
 *      même si une couche héritée renvoyait l'union) ;
 *  (2) DocumentSwitcher n'affiche qu'UNE entrée par document et ouvre MA session
 *      via createAnnotation (jamais l'annotation d'un autre).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { useProjectDocuments } from "@/lib/api/hooks";
import { DocumentSwitcher } from "@/components/workspace/DocumentSwitcher";

const BASE = "/api/v1";

/** Réponse « union » non dédupliquée : le MÊME document répété 3× (1 par annotateur). */
function unionHandler() {
  const dup = {
    document: {
      id: "doc-9gag",
      corpusId: "c1",
      externalId: "9gag",
      title: "9gag",
      language: "en",
      nSentences: 12,
      hasTranslation: true,
    },
    mySession: { annotatorId: "u-me", username: "me", displayName: "Me", color: "#06B6D4", assigned: true, status: "draft", annotationId: "ann-9", nClauses: 0 },
  };
  const other = {
    document: { id: "doc-airbnb", corpusId: "c1", externalId: "airbnb", title: "Airbnb", language: "en", nSentences: 30, hasTranslation: false },
    mySession: { annotatorId: "u-me", username: "me", displayName: "Me", color: "#06B6D4", assigned: true, status: "unstarted", annotationId: null, nClauses: 0 },
  };
  return http.get(`${BASE}/projects/:slug/documents`, () =>
    HttpResponse.json({ count: 4, next: null, previous: null, results: [dup, dup, dup, other] }),
  );
}

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => push.mockReset());
afterEach(() => cleanup());

describe("useProjectDocuments — déduplication", () => {
  it("déduplique par document.id même si l'API renvoie l'union", async () => {
    server.use(unionHandler());
    const { result } = renderHook(() => useProjectDocuments("campagne-pactiva", { mine: true }), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    const ids = (result.current.data?.results ?? []).map((r) => r.document.id);
    // 4 lignes en entrée (3× 9gag + 1 airbnb) → 2 documents distincts.
    expect(ids).toEqual(["doc-9gag", "doc-airbnb"]);
  });
});

describe("DocumentSwitcher — 1 entrée/document + ouverture de MA session", () => {
  it("n'affiche qu'une option par document et ouvre via createAnnotation", async () => {
    server.use(
      unionHandler(),
      // createAnnotation → POST /annotations renvoie MA session (id stable).
      http.post(`${BASE}/annotations`, async () =>
        HttpResponse.json({ id: "ann-mine", projectSlug: "campagne-pactiva", documentId: "doc-9gag", annotatorId: "u-me", status: "draft", clauses: [] }, { status: 201 }),
      ),
    );
    render(
      <DocumentSwitcher projectSlug="campagne-pactiva" currentDocumentId="doc-9gag" />,
      { wrapper: wrapper() },
    );
    // Ouvrir le combobox.
    fireEvent.click(screen.getByTestId("document-switcher-button"));
    await waitFor(() => expect(screen.getAllByTestId("document-option-doc-9gag").length).toBeGreaterThan(0));
    // 9gag n'apparaît qu'UNE fois (pas 3×) malgré l'union renvoyée par l'API.
    expect(screen.getAllByTestId("document-option-doc-9gag")).toHaveLength(1);
    expect(screen.getAllByTestId("document-option-doc-airbnb")).toHaveLength(1);

    // Cliquer ouvre MA session via createAnnotation → navigation vers /annotate/{id}.
    fireEvent.click(screen.getByTestId("document-option-doc-airbnb"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/annotate/ann-mine"));
  });
});
