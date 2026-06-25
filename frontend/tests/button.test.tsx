import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/primitives";

describe("Button — machine d'états (repos/en cours/succès/erreur)", () => {
  it("repos : cliquable, aucun voyant, pas d'aria-busy", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Valider</Button>);
    const btn = screen.getByRole("button", { name: "Valider" });
    expect(btn).toHaveAttribute("data-state", "idle");
    expect(btn).not.toHaveAttribute("aria-busy");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("en cours (loading) : aria-busy, désactivé (non cliquable), spinner", () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Soumettre</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("data-state", "pending");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled(); // bloqué pendant le chargement (anti double-clic)
    expect(btn.querySelector("svg.animate-spin")).toBeTruthy();
  });

  it("state=pending équivaut à loading", () => {
    render(<Button state="pending">X</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("succès : voyant ✓, reste cliquable (non bloquant)", () => {
    const onClick = vi.fn();
    render(<Button state="success" onClick={onClick}>Enregistré</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("data-state", "success");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it("erreur : annonce role=alert, reste cliquable (réessayer), liseré danger", () => {
    const onClick = vi.fn();
    render(<Button state="error" onClick={onClick}>Réessayer</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("data-state", "error");
    expect(btn).not.toBeDisabled(); // l'erreur n'empêche pas de réessayer
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it("variantes sémantiques danger/success tokenisées (zéro hex)", () => {
    const { rerender } = render(<Button variant="danger">Supprimer</Button>);
    expect(screen.getByRole("button").className).toContain("bg-danger");
    rerender(<Button variant="success">Confirmer</Button>);
    expect(screen.getByRole("button").className).toContain("bg-success");
  });

  it("tailles sm/md/lg", () => {
    const { rerender } = render(<Button size="sm">a</Button>);
    expect(screen.getByRole("button").className).toContain("text-xs");
    rerender(<Button size="lg">a</Button>);
    expect(screen.getByRole("button").className).toContain("text-base");
  });

  it("rétro-compatible : variant par défaut + props natives (disabled, data-testid)", () => {
    render(<Button disabled data-testid="b">old</Button>);
    const btn = screen.getByTestId("b");
    expect(btn).toBeDisabled();
    expect(btn.className).toContain("border-line"); // variant 'outline' par défaut
  });
});
