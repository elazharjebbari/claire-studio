/**
 * GoldCockpit — rendu de la liste des documents GOLD via MSW (statut, avancement, verrou).
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
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
    expect(screen.getByTestId("gold-status-Academia")).toHaveTextContent("Résolue");
    expect(screen.getByTestId("gold-status-Borea")).toHaveTextContent("En attente");
    // Document en attente : indicateur de complétude des annotations.
    expect(screen.getByTestId("gold-readiness-Borea")).toHaveTextContent("1/3 annotateurs");

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

  it("ouvre et ferme la modale « Comment ça marche ? »", async () => {
    render(<GoldCockpit slug="claudette-gold-v1" />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByTestId("gold-cockpit")).toBeInTheDocument());
    expect(screen.queryByTestId("gold-help-modal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("gold-help-open"));
    expect(screen.getByTestId("gold-help-modal")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("gold-help-close"));
    expect(screen.queryByTestId("gold-help-modal")).not.toBeInTheDocument();
  });

  it("expose le lien Stats et (admin) le bouton d'export gold", async () => {
    render(<GoldCockpit slug="claudette-gold-v1" />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByTestId("gold-cockpit")).toBeInTheDocument());
    expect(screen.getByTestId("gold-stats-link")).toHaveAttribute(
      "href",
      "/projects/claudette-gold-v1/gold/stats",
    );
    // FIXTURE_USER est admin → bouton d'export visible.
    const exportBtn = await screen.findByTestId("gold-export");
    fireEvent.click(exportBtn);
    await waitFor(() => expect(screen.getByTestId("gold-export-started")).toBeInTheDocument());
  });
});
