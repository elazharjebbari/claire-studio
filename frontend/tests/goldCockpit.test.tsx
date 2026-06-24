/**
 * GoldCockpit — rendu de la liste des documents GOLD via MSW (statut, avancement, verrou).
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoldCockpit } from "@/components/gold/GoldCockpit";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

afterEach(() => cleanup());

describe("GoldCockpit", () => {
  it("affiche une ligne par document avec statut et verrou (fixtures MSW)", async () => {
    render(<GoldCockpit slug="claudette-gold-v1" />, { wrapper: wrapper() });

    await waitFor(() => expect(screen.getByTestId("gold-cockpit")).toBeInTheDocument());

    // 3 documents de la fixture.
    expect(screen.getByTestId("gold-doc-Atlas")).toBeInTheDocument();
    expect(screen.getByTestId("gold-doc-Academia")).toBeInTheDocument();
    expect(screen.getByTestId("gold-doc-Borea")).toBeInTheDocument();

    // Statuts distincts.
    expect(screen.getByTestId("gold-status-Atlas")).toHaveTextContent("En cours");
    expect(screen.getByTestId("gold-status-Academia")).toHaveTextContent("Résolu");
    expect(screen.getByTestId("gold-status-Borea")).toHaveTextContent("Non résolu");

    // Verrou affiché sur Academia (lockedBy zahra.boulaich).
    expect(screen.getByTestId("gold-doc-lock-Academia")).toHaveTextContent("zahra.boulaich");

    // Lien vers l'atelier.
    expect(screen.getByTestId("gold-doc-Atlas")).toHaveAttribute(
      "href",
      "/projects/claudette-gold-v1/gold/Atlas",
    );
  });

  it("calcule les KPIs de synthèse", async () => {
    render(<GoldCockpit slug="claudette-gold-v1" />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByTestId("gold-cockpit")).toBeInTheDocument());
    const kpis = screen.getAllByTestId("gold-kpi").map((n) => n.textContent);
    // 3 documents, 1 résolu.
    expect(kpis).toContain("3");
    expect(kpis).toContain("1/3");
  });
});
