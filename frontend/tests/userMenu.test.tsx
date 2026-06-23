import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// Dépendances externes du UserMenu : identité (useMe), purge des jetons (api.logout),
// cache (useQueryClient). On les pilote pour tester l'ouverture + la déconnexion sans réseau.
vi.mock("@/lib/api/hooks", () => ({ useMe: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ({ logout: vi.fn() }));
const clearSpy = vi.fn();
vi.mock("@tanstack/react-query", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ clear: clearSpy }),
}));

import { useMe } from "@/lib/api/hooks";
import { logout as apiLogout } from "@/lib/api/endpoints";
import { UserMenu } from "@/components/shell/UserMenu";

const mockUseMe = useMe as unknown as ReturnType<typeof vi.fn>;

describe("UserMenu — menu déroulant + déconnexion", () => {
  beforeEach(() => {
    mockUseMe.mockReturnValue({
      data: { id: 7, username: "zahra.boulaich", displayName: "Zahra", role: "annotator", email: "z@pactiva.legal" },
    });
    (apiLogout as unknown as ReturnType<typeof vi.fn>).mockClear();
    clearSpy.mockClear();
    // window.location.assign : jsdom ne navigue pas réellement → on l'espionne.
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign: vi.fn() },
      writable: true,
    });
  });
  afterEach(() => vi.clearAllMocks());

  it("affiche le nom et ouvre le menu au clic (Paramètres + Déconnexion)", () => {
    render(<UserMenu />);
    expect(screen.getByTestId("user-menu-trigger")).toHaveTextContent("Zahra");
    expect(screen.queryByTestId("user-menu")).toBeNull();
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
    expect(screen.getByTestId("user-menu-settings")).toHaveAttribute("href", "/settings");
    expect(screen.getByTestId("user-menu-logout")).toBeInTheDocument();
  });

  it("déconnexion : purge les jetons, vide le cache et redirige vers /login", () => {
    render(<UserMenu />);
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    fireEvent.click(screen.getByTestId("user-menu-logout"));
    expect(apiLogout).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith("/login");
  });

  it("se ferme avec Échap", () => {
    render(<UserMenu />);
    fireEvent.click(screen.getByTestId("user-menu-trigger"));
    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("user-menu")).toBeNull();
  });
});
