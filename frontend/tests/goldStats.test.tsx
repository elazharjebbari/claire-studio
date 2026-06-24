/**
 * GoldStatsPanel — classement de concordance avec le gold (via MSW).
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoldStatsPanel } from "@/components/gold/GoldStatsPanel";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

afterEach(() => cleanup());

describe("GoldStatsPanel", () => {
  it("affiche le plus proche du gold et le classement des annotateurs", async () => {
    render(<GoldStatsPanel slug="claudette-gold-v1" />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByTestId("gold-stats")).toBeInTheDocument());

    expect(screen.getByTestId("gold-closest")).toHaveTextContent("Alice");
    expect(screen.getByTestId("gold-closest")).toHaveTextContent("92%");

    // 3 annotateurs classés.
    expect(screen.getByTestId("gold-stat-alice")).toHaveTextContent("92%");
    expect(screen.getByTestId("gold-stat-carol")).toHaveTextContent("64%");

    // Modèles ↔ gold + κ inter-annotateurs.
    expect(screen.getByTestId("gold-judges")).toHaveTextContent("claude");
    expect(screen.getByText("0.74")).toBeInTheDocument();
  });
});
