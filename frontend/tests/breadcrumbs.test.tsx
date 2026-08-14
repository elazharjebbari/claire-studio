/**
 * Fil d'Ariane — audit UI Lab (docs/pactiva-lab-ui/01_AUDIT.md §2.3, §4).
 *
 * Deux bugs réels trouvés en observant /projects/[slug]/lab/runs/[id] en prod :
 *  1. les segments "lab" et "runs" n'étaient dans aucune table de libellés → affichés
 *     en minuscules brutes, et l'UUID du run affiché en entier (illisible) ;
 *  2. "runs" n'étant pas dans NO_INDEX_SEGMENTS, le fil d'Ariane générait un <Link>
 *     vers /projects/[slug]/lab/runs — route qui n'existe pas (seules /lab et
 *     /lab/runs/[id] existent) → Next.js préfetchait un 404 à chaque chargement de
 *     page (confirmé par capture réseau : `[http 404] .../lab/runs?_rsc=…`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

let pathname = "/projects/campagne-pactiva/lab/runs/754a17a3-71a7-4c75-8dac-805c0148aecc";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock("@/lib/api/hooks", () => ({ useProject: vi.fn() }));
import { useProject } from "@/lib/api/hooks";
import { Breadcrumbs } from "@/components/shell/Breadcrumbs";

const mockUseProject = useProject as unknown as ReturnType<typeof vi.fn>;

afterEach(cleanup);
beforeEach(() => {
  mockUseProject.mockReturnValue({ data: { name: "Campagne d'annotation Pactiva" } });
});

describe("Breadcrumbs — /projects/[slug]/lab/runs/[id]", () => {
  it("affiche des libellés lisibles pour lab et runs, pas les segments d'URL bruts", () => {
    render(<Breadcrumbs />);
    const nav = screen.getByTestId("breadcrumbs");
    expect(nav.textContent).toContain("Lab");
    expect(nav.textContent).toContain("Expériences");
    expect(nav.textContent).not.toMatch(/\blab\b/); // pas le segment brut en minuscules
  });

  it("raccourcit l'UUID du run plutôt que de l'afficher en entier", () => {
    render(<Breadcrumbs />);
    const nav = screen.getByTestId("breadcrumbs");
    expect(nav.textContent).not.toContain(
      "754a17a3-71a7-4c75-8dac-805c0148aecc",
    );
    expect(nav.textContent).toContain("754a17a3…");
  });

  it("⭐ le segment « runs » n'est PAS un lien : /lab/runs n'existe pas (régression 404 réelle)", () => {
    render(<Breadcrumbs />);
    // "Expériences" est le libellé du segment "runs" — il ne doit pas être cliquable.
    expect(screen.queryByRole("link", { name: /expériences/i })).not.toBeInTheDocument();
    expect(screen.getByText("Expériences").closest("a")).toBeNull();
  });

  it("le segment « lab », lui, a bien une page d'index : reste un lien", () => {
    render(<Breadcrumbs />);
    expect(screen.getByRole("link", { name: /^lab$/i })).toHaveAttribute(
      "href",
      "/projects/campagne-pactiva/lab",
    );
  });

  it("le nom du projet reste résolu depuis l'API, pas le slug", () => {
    render(<Breadcrumbs />);
    expect(screen.getByText("Campagne d'annotation Pactiva")).toBeInTheDocument();
  });
});

describe("Breadcrumbs — routes non-Lab (pas de régression)", () => {
  it("un segment qui n'est pas un UUID s'affiche tel quel", () => {
    pathname = "/projects/campagne-pactiva/docs";
    render(<Breadcrumbs />);
    expect(screen.getByText("Documents")).toBeInTheDocument();
  });
});
