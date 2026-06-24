/**
 * GoldWorkspace (atelier) — assemblage 3 panneaux + verrou + décision, via MSW.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { useGoldStore } from "@/store/goldStore";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { GoldWorkspace } from "@/components/gold/GoldWorkspace";

const BASE = "/api/v1";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() =>
  useGoldStore.setState({ docKey: null, selectedIndex: null, hoverIndex: null, filter: "all", parkY: null }),
);
afterEach(() => cleanup());

describe("GoldWorkspace", () => {
  it("monte les 3 panneaux et liste les phrases", async () => {
    render(<GoldWorkspace slug="claudette-gold-v1" documentId="Atlas" />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByTestId("gold-workspace")).toBeInTheDocument());
    expect(screen.getByTestId("gold-outline")).toBeInTheDocument();
    expect(screen.getByTestId("gold-reading")).toBeInTheDocument();
    expect(screen.getByTestId("gold-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("gold-row-2")).toBeInTheDocument();
  });

  it("acquiert le verrou (Vous arbitrez) et auto-sélectionne le 1ᵉʳ conflit inter-annotateurs", async () => {
    render(<GoldWorkspace slug="claudette-gold-v1" documentId="Atlas" />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByTestId("gold-lock-mine")).toBeInTheDocument());
    // index 0 est auto-résolu → 1ʳᵉ non décidée = index 1 (désaccord alice/bob).
    expect(screen.getByTestId("gold-inspector")).toHaveTextContent("Phrase 1");
    // Aucun bandeau « signal fort » : les LLM ne créent jamais de conflit.
    expect(screen.queryByTestId("gold-dissent")).not.toBeInTheDocument();
  });

  it("clic sur un candidat envoie la décision au serveur", async () => {
    const calls: Array<Record<string, unknown>> = [];
    server.use(
      http.post(`${BASE}/projects/:slug/gold/:externalId/decide`, async ({ request }) => {
        calls.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          index: 1, decided: true, autoResolved: false, primary: "PRIVACY",
          secondaries: [], status: "in_progress", pctResolved: 0.66,
        });
      }),
    );
    render(<GoldWorkspace slug="claudette-gold-v1" documentId="Atlas" />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByTestId("gold-lock-mine")).toBeInTheDocument());
    // L'inspecteur (phrase 1) propose PRIVACY (annotateurs) parmi les candidats.
    const btn = await screen.findByTestId("gold-decide-PRIVACY");
    fireEvent.click(btn);
    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]).toMatchObject({ index: 1, primary: "PRIVACY" });
  });

  it("décision refusée (409) → annule l'avance optimiste (re-sélectionne la phrase)", async () => {
    server.use(
      http.post(`${BASE}/projects/:slug/gold/:externalId/decide`, () =>
        HttpResponse.json({ detail: "Document en cours d'arbitrage par un autre arbitre." }, { status: 409 }),
      ),
    );
    render(<GoldWorkspace slug="claudette-gold-v1" documentId="Atlas" />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByTestId("gold-lock-mine")).toBeInTheDocument());
    // Sélection initiale = phrase 1 (dissent).
    expect(screen.getByTestId("gold-inspector")).toHaveTextContent("Phrase 1");
    fireEvent.click(await screen.findByTestId("gold-decide-PRIVACY"));
    // Après le 409, l'avance optimiste est annulée → on revient sur la phrase 1.
    await waitFor(() => expect(screen.getByTestId("gold-inspector")).toHaveTextContent("Phrase 1"));
  });

  it("le filtre « conflits » restreint la liste du plan", async () => {
    render(<GoldWorkspace slug="claudette-gold-v1" documentId="Atlas" />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByTestId("gold-outline")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("gold-filter-conflicts"));
    // index 0 (strict, décidé) disparaît du plan ; index 1 (dissent) reste.
    await waitFor(() => expect(screen.queryByTestId("gold-outline-0")).not.toBeInTheDocument());
    expect(screen.getByTestId("gold-outline-1")).toBeInTheDocument();
  });
});
