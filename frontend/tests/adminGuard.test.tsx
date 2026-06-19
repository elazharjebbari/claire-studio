import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { isAdminRole } from "@/lib/roles";

// useMe est la seule dépendance externe d'AdminGuard ; on la mocke pour piloter
// le rôle/état sans QueryClient ni réseau.
vi.mock("@/lib/api/hooks", () => ({ useMe: vi.fn() }));
import { useMe } from "@/lib/api/hooks";
import { AdminGuard } from "@/components/auth/AdminGuard";

const mockUseMe = useMe as unknown as ReturnType<typeof vi.fn>;

describe("isAdminRole", () => {
  it("vrai pour admin/owner, faux sinon", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("annotator")).toBe(false);
    expect(isAdminRole("reviewer")).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});

describe("AdminGuard (garde de rôle, chantier G)", () => {
  beforeEach(() => mockUseMe.mockReset());

  it("rend la console pour un admin", () => {
    mockUseMe.mockReturnValue({ data: { role: "admin" }, isLoading: false });
    render(
      <AdminGuard>
        <div data-testid="admin-content">console</div>
      </AdminGuard>,
    );
    expect(screen.getByTestId("admin-content")).toBeInTheDocument();
  });

  it("affiche un 403 pour un annotateur (séparation des espaces)", () => {
    mockUseMe.mockReturnValue({ data: { role: "annotator" }, isLoading: false });
    render(
      <AdminGuard>
        <div data-testid="admin-content">console</div>
      </AdminGuard>,
    );
    expect(screen.getByTestId("admin-forbidden")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-content")).not.toBeInTheDocument();
  });

  it("état neutre pendant la vérification des droits", () => {
    mockUseMe.mockReturnValue({ data: undefined, isLoading: true });
    render(
      <AdminGuard>
        <div data-testid="admin-content">console</div>
      </AdminGuard>,
    );
    expect(screen.getByTestId("admin-checking")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-content")).not.toBeInTheDocument();
  });
});
