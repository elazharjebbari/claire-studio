/**
 * DocStatusBadge (point 2) — statut + verrou par document sur les pages projet.
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DocStatusBadge } from "@/components/projects/DocStatusBadge";

afterEach(cleanup);

describe("DocStatusBadge", () => {
  it("affiche le libellé FR par statut", () => {
    const cases: Array<[Parameters<typeof DocStatusBadge>[0]["status"], string]> = [
      ["unstarted", "Non commencé"],
      ["draft", "Brouillon"],
      ["submitted", "Soumis"],
      ["in_review", "En revue"],
      ["approved", "Approuvé"],
      ["rejected", "Rejeté"],
    ];
    for (const [status, label] of cases) {
      cleanup();
      render(<DocStatusBadge status={status} />);
      expect(screen.getByTestId("doc-status-badge")).toHaveTextContent(label);
      expect(screen.getByTestId("doc-status-badge")).toHaveAttribute("data-status", status);
    }
  });

  it("montre le cadenas quand verrouillé, pas sinon", () => {
    const { rerender } = render(<DocStatusBadge status="submitted" locked />);
    expect(screen.getByTestId("doc-status-badge")).toHaveAttribute("data-locked", "true");
    expect(screen.getByTestId("doc-status-lock")).toBeInTheDocument();

    rerender(<DocStatusBadge status="draft" locked={false} />);
    expect(screen.getByTestId("doc-status-badge")).toHaveAttribute("data-locked", "false");
    expect(screen.queryByTestId("doc-status-lock")).not.toBeInTheDocument();
  });

  it("peut être verrouillé même en brouillon (verrou manuel)", () => {
    render(<DocStatusBadge status="draft" locked />);
    const badge = screen.getByTestId("doc-status-badge");
    expect(badge).toHaveTextContent("Brouillon");
    expect(badge).toHaveAttribute("data-locked", "true");
  });
});
