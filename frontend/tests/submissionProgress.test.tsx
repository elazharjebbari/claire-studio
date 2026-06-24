/**
 * SubmissionProgressDialog — soumission en tâche de fond : barre + étapes + notification.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SubmissionProgressDialog } from "@/components/workspace/SubmissionProgressDialog";

afterEach(cleanup);

describe("SubmissionProgressDialog", () => {
  it("affiche l'étape en cours (running) sans bouton de fermeture", () => {
    render(<SubmissionProgressDialog phase="version" error={null} onRetry={() => {}} onClose={() => {}} />);
    const dlg = screen.getByTestId("submission-progress");
    expect(dlg).toHaveAttribute("data-state", "running");
    expect(dlg).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/Publication en cours/)).toBeInTheDocument();
    // L'étape « enregistrement » (avant) est faite ; « version » est active.
    expect(screen.getByTestId("submission-step-save")).toBeInTheDocument();
    expect(screen.getByTestId("submission-step-version")).toBeInTheDocument();
    // Pas d'actions tant que ça tourne.
    expect(screen.queryByTestId("submission-retry")).not.toBeInTheDocument();
  });

  it("état d'erreur : message + Réessayer + Fermer", () => {
    const onRetry = vi.fn();
    const onClose = vi.fn();
    render(
      <SubmissionProgressDialog
        phase="save"
        error="Des modifications n'ont pas pu être enregistrées."
        onRetry={onRetry}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId("submission-progress")).toHaveAttribute("data-state", "error");
    expect(screen.getByText(/La publication a échoué/)).toBeInTheDocument();
    expect(screen.getByTestId("submission-error")).toHaveTextContent("pas pu être enregistrées");
    fireEvent.click(screen.getByTestId("submission-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("submission-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("la barre de progression avance avec la phase", () => {
    const { rerender } = render(
      <SubmissionProgressDialog phase="save" error={null} onRetry={() => {}} onClose={() => {}} />,
    );
    const bar = () => screen.getByRole("progressbar");
    const save = Number(bar().getAttribute("aria-valuenow"));
    rerender(<SubmissionProgressDialog phase="publish" error={null} onRetry={() => {}} onClose={() => {}} />);
    const publish = Number(bar().getAttribute("aria-valuenow"));
    expect(publish).toBeGreaterThan(save);
  });
});
