/**
 * Navigation mobile — audit UI Lab (docs/pactiva-lab-ui/01_AUDIT.md §2.1).
 *
 * Avant ce correctif, la sidebar (`w-56`, 224px) restait TOUJOURS en flux, à toute
 * largeur d'écran : sur un mobile de 375px, elle mangeait ~60% de l'écran et le
 * contenu restant faisait se chevaucher deux valeurs de métrique (capture d'écran
 * prod, 14 août 2026). Elle devient un tiroir hors-flux (position fixed, fermé par
 * défaut) sous `md`, piloté par `useUiStore.mobileNavOpen` — jamais persisté : un
 * tiroir qui resterait ouvert après rechargement ou navigation serait pire que le
 * bug d'origine.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/campagne-pactiva/lab/runs/754a17a3-71a7-4c75-8dac-805c0148aecc",
}));

vi.mock("@/lib/api/hooks", () => ({
  useMe: () => ({ data: { username: "elazhar.jebbari", role: "owner" } }),
  useProjects: () => ({ data: { results: [{ slug: "campagne-pactiva", name: "Campagne" }] } }),
  useActivity: () => ({ data: { results: [] } }),
}));

import { useUiStore } from "@/store/ui";
import { usePrefsStore } from "@/store/prefs";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";

afterEach(cleanup);
beforeEach(() => {
  useUiStore.setState({ mobileNavOpen: false });
});

describe("Sidebar — tiroir mobile", () => {
  it("fermé par défaut : la nav est hors-écran, pas de fond assombri", () => {
    render(<Sidebar />);
    expect(screen.getByLabelText("Navigation principale")).toHaveClass("-translate-x-full");
    expect(screen.queryByTestId("app-sidebar-backdrop")).not.toBeInTheDocument();
  });

  it("ouvert (mobileNavOpen=true) : la nav glisse à l'écran, un fond cliquable apparaît", () => {
    // L'ouverture réaliste se produit APRÈS le montage (clic sur le hamburger de la
    // TopBar, cf. describe ci-dessous) — pas avant, sinon l'effet de fermeture-sur-
    // navigation (qui tourne aussi au montage initial) la refermerait aussitôt.
    render(<Sidebar />);
    act(() => useUiStore.getState().setMobileNavOpen(true));
    expect(screen.getByLabelText("Navigation principale")).toHaveClass("translate-x-0");
    expect(screen.getByTestId("app-sidebar-backdrop")).toBeInTheDocument();
  });

  it("cliquer le fond referme le tiroir", () => {
    render(<Sidebar />);
    act(() => useUiStore.getState().setMobileNavOpen(true));
    fireEvent.click(screen.getByTestId("app-sidebar-backdrop"));
    expect(useUiStore.getState().mobileNavOpen).toBe(false);
  });

  it("le bouton de fermeture dédié referme le tiroir", () => {
    render(<Sidebar />);
    act(() => useUiStore.getState().setMobileNavOpen(true));
    fireEvent.click(screen.getByTestId("app-sidebar-close"));
    expect(useUiStore.getState().mobileNavOpen).toBe(false);
  });

  it("Échap referme le tiroir", () => {
    render(<Sidebar />);
    act(() => useUiStore.getState().setMobileNavOpen(true));
    expect(useUiStore.getState().mobileNavOpen).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useUiStore.getState().mobileNavOpen).toBe(false);
  });

  it("⭐ ne survit jamais à une navigation : remonter avec un mobileNavOpen=true déjà en store le referme", () => {
    // Simule l'état juste après un clic sur un lien (navigation en cours) : le
    // composant se remonte sur le nouveau pathname, l'effet de nettoyage doit tourner.
    useUiStore.setState({ mobileNavOpen: true });
    render(<Sidebar />);
    expect(useUiStore.getState().mobileNavOpen).toBe(false);
  });

  it("les libellés restent visibles dans le tiroir même si la sidebar desktop est repliée", () => {
    // `collapsed` (pref desktop persistée) ne doit jamais rendre le tiroir mobile
    // illisible — showLabels = mobileOpen || !collapsed, pas juste !collapsed.
    usePrefsStore.getState().setPanel("sidebarCollapsed", true);
    render(<Sidebar />);
    act(() => useUiStore.getState().setMobileNavOpen(true));
    expect(screen.getByText("Accueil")).toBeInTheDocument();
    expect(screen.getByText("Lab")).toBeInTheDocument();
    usePrefsStore.getState().setPanel("sidebarCollapsed", false);
  });
});

describe("TopBar + Sidebar — le bouton hamburger pilote réellement le tiroir", () => {
  function renderShell() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <TopBar />
        <Sidebar />
      </QueryClientProvider>,
    );
  }

  it("cliquer le hamburger de la TopBar ouvre le tiroir de la Sidebar", () => {
    renderShell();
    expect(screen.getByLabelText("Navigation principale")).toHaveClass("-translate-x-full");
    fireEvent.click(screen.getByTestId("app-sidebar-open"));
    expect(screen.getByLabelText("Navigation principale")).toHaveClass("translate-x-0");
  });
});
