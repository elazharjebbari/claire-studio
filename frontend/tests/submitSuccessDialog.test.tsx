/**
 * Modale de confirmation de SUCCÈS de soumission (point 1) : confirme la réussite,
 * explique le verrouillage et propose un déverrouillage immédiat.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SubmitSuccessDialog } from "@/components/workspace/SubmitSuccessDialog";

afterEach(cleanup);

describe("SubmitSuccessDialog", () => {
  it("confirme la réussite, nomme la version et explique le verrouillage", () => {
    render(<SubmitSuccessDialog versionName="v1 — relecture" onClose={() => {}} />);
    expect(screen.getByTestId("submit-success-dialog")).toBeInTheDocument();
    expect(screen.getByText(/Annotation soumise/)).toBeInTheDocument();
    expect(screen.getByText(/v1 — relecture/)).toBeInTheDocument();
    // L'encart explique le verrouillage ET la possibilité de déverrouiller.
    const note = screen.getByTestId("submit-success-lock-note");
    expect(note).toHaveTextContent(/verrouillé/i);
    expect(note).toHaveTextContent(/déverrouiller/i);
  });

  it("affiche le bouton « Déverrouiller » qui déverrouille puis ferme", () => {
    const onUnlock = vi.fn();
    const onClose = vi.fn();
    render(<SubmitSuccessDialog versionName="v1" onClose={onClose} onUnlock={onUnlock} />);
    fireEvent.click(screen.getByTestId("submit-success-unlock"));
    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("masque le bouton de déverrouillage quand l'action est indisponible (verrou projet)", () => {
    render(<SubmitSuccessDialog versionName="v1" onClose={() => {}} />);
    expect(screen.queryByTestId("submit-success-unlock")).not.toBeInTheDocument();
    expect(screen.getByTestId("submit-success-close")).toBeInTheDocument();
  });

  it("ferme sur Échap et au clic « Compris »", () => {
    const onClose = vi.fn();
    render(<SubmitSuccessDialog versionName="v1" onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("submit-success-close"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
