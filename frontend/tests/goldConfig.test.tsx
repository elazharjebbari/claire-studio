/**
 * GoldConfigStudio — charge la config + membres, ajoute un arbitre, enregistre (MSW).
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { GoldConfigStudio } from "@/components/gold/GoldConfigStudio";

const BASE = "/api/v1";

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

  it("⭐ déclare les PARTICIPANTS ATTENDUS et les enregistre (déblocage de campagne)", async () => {
    const saved: Array<Record<string, unknown>> = [];
    server.use(
      http.patch(`${BASE}/projects/:slug/gold/config`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        saved.push(body);
        return HttpResponse.json({ ...body, v: 1 });
      }),
    );
    render(<GoldConfigStudio slug="claudette-gold-v1" />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByTestId("gold-config")).toBeInTheDocument());

    // Deux sélecteurs distincts coexistent : arbitres ET participants attendus.
    expect(screen.getByTestId("arbiter-picker")).toBeInTheDocument();
    expect(screen.getByTestId("participant-picker")).toBeInTheDocument();

    fireEvent.focus(screen.getByTestId("participant-input"));
    fireEvent.change(screen.getByTestId("participant-input"), { target: { value: "bruno" } });
    fireEvent.mouseDown(await screen.findByTestId("participant-option-bruno"));
    expect(screen.getByTestId("participant-chip-bruno")).toBeInTheDocument();

    const save = screen.getByTestId("gold-config-save");
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);
    await waitFor(() => expect(saved.length).toBe(1));
    expect(saved[0]?.expectedAnnotators).toEqual(["bruno"]);
  });

  it("permet d'ajouter/retirer les comptes annotateurs issus des LLM", async () => {
    const calls: Array<Record<string, unknown>> = [];
    server.use(
      http.post(`${BASE}/projects/:slug/gold/llm-annotators`, async ({ request }) => {
        const b = (await request.json()) as Record<string, unknown>;
        calls.push(b);
        return HttpResponse.json({ judge: b.judge, added: b.action === "add" });
      }),
    );
    render(<GoldConfigStudio slug="claudette-gold-v1" />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByTestId("gold-llm-annotators")).toBeInTheDocument());
    // claude = référence (bouton Ajouter) ; codex = déjà annotateur (bouton Retirer).
    expect(screen.getByTestId("gold-llm-add-claude")).toBeInTheDocument();
    expect(screen.getByTestId("gold-llm-remove-codex")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("gold-llm-add-claude"));
    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]).toMatchObject({ judge: "claude", action: "add" });
  });
});
