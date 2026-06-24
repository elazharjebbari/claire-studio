/**
 * GoldConfigStudio — charge la config + membres, ajoute un arbitre, enregistre (MSW).
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoldConfigStudio } from "@/components/gold/GoldConfigStudio";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

afterEach(() => cleanup());

describe("GoldConfigStudio", () => {
  it("charge la config et le sélecteur d'arbitres", async () => {
    render(<GoldConfigStudio slug="claudette-gold-v1" />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByTestId("gold-config")).toBeInTheDocument());
    expect(screen.getByTestId("arbiter-picker")).toBeInTheDocument();
    // Bouton d'enregistrement désactivé tant qu'aucune modification.
    expect(screen.getByTestId("gold-config-save")).toBeDisabled();
  });

  it("ajoute un arbitre via l'autocomplétion puis enregistre", async () => {
    render(<GoldConfigStudio slug="claudette-gold-v1" />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByTestId("gold-config")).toBeInTheDocument());

    fireEvent.focus(screen.getByTestId("arbiter-input"));
    fireEvent.change(screen.getByTestId("arbiter-input"), { target: { value: "bruno" } });
    fireEvent.mouseDown(await screen.findByTestId("arbiter-option-bruno"));

    // Le chip apparaît et le bouton devient actif (modifié).
    expect(screen.getByTestId("arbiter-chip-bruno")).toBeInTheDocument();
    const save = screen.getByTestId("gold-config-save");
    await waitFor(() => expect(save).not.toBeDisabled());

    fireEvent.click(save);
    await waitFor(() => expect(screen.getByTestId("gold-config-saved")).toBeInTheDocument());
  });

  it("bascule l'auto-résolution des majorités et l'active à l'enregistrement", async () => {
    render(<GoldConfigStudio slug="claudette-gold-v1" />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByTestId("gold-config")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("config-majority"));
    await waitFor(() => expect(screen.getByTestId("gold-config-save")).not.toBeDisabled());
  });

  it("n'expose AUCUN réglage de décision LLM (résolution inter-annotateurs)", async () => {
    render(<GoldConfigStudio slug="claudette-gold-v1" />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByTestId("gold-config")).toBeInTheDocument());
    expect(screen.queryByTestId("config-llm-role")).not.toBeInTheDocument();
    expect(screen.queryByTestId("config-llm-weight")).not.toBeInTheDocument();
  });
});
