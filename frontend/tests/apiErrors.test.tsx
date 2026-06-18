/**
 * Tests du store d'erreurs API et de son rendu en bandeau (ApiErrorBanner).
 *
 *  - Collecte : push() n'ingère que des ApiError, extrait status/endpoint, et
 *    ignore le 401 (géré par la garde d'auth, pas un toast).
 *  - Affichage : le bandeau (data-testid="api-error-banner") montre status,
 *    endpoint et message ; le bouton fermer retire l'entrée.
 */

import { afterEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useApiErrorStore } from "@/store/apiErrors";
import { ApiError } from "@/lib/api/client";
import { ApiErrorBanner } from "@/components/debug/ApiErrorBanner";

afterEach(() => {
  cleanup();
  useApiErrorStore.getState().clear();
});

describe("useApiErrorStore", () => {
  it("collecte une ApiError avec status + endpoint", () => {
    const store = useApiErrorStore.getState();
    store.push(new ApiError(404, "API 404 on /projects", { detail: "x" }));
    const errors = useApiErrorStore.getState().errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]?.status).toBe(404);
    expect(errors[0]?.endpoint).toBe("/projects");
  });

  it("ignore les non-ApiError et les 401", () => {
    const store = useApiErrorStore.getState();
    store.push(new Error("boom"));
    store.push(new ApiError(401, "API 401 on /me"));
    expect(useApiErrorStore.getState().errors).toHaveLength(0);
  });

  it("dismiss retire l'entrée ciblée", () => {
    const store = useApiErrorStore.getState();
    store.push(new ApiError(500, "API 500 on /annotations"));
    const id = useApiErrorStore.getState().errors[0]!.id;
    useApiErrorStore.getState().dismiss(id);
    expect(useApiErrorStore.getState().errors).toHaveLength(0);
  });
});

describe("ApiErrorBanner", () => {
  it("ne rend rien sans erreur", () => {
    render(<ApiErrorBanner />);
    expect(screen.queryByTestId("api-error-banner")).toBeNull();
  });

  it("affiche le status, l'endpoint et permet de fermer", () => {
    useApiErrorStore.getState().push(new ApiError(503, "API 503 on /exports"));
    render(<ApiErrorBanner />);
    const banner = screen.getByTestId("api-error-banner");
    expect(banner).toBeInTheDocument();
    expect(screen.getByText("503")).toBeInTheDocument();
    expect(screen.getByText("/exports")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Fermer"));
    expect(screen.queryByTestId("api-error-banner")).toBeNull();
  });
});
