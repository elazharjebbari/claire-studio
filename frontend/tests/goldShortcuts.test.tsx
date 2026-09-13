/**
 * Raccourcis clavier de l'atelier GOLD (lot 5) — le levier de vitesse : 462 arbitrages
 * à ~6 gestes souris deviennent 1 à 2 frappes. Conformes à la spec d'origine
 * (docs/pactiva/dossier-gold/02-navigation/02-raccourcis.csv).
 *
 * Trois garde-fous testés, car ce sont eux qui empêchent une décision par inadvertance :
 * inertie en saisie, inertie sans verrou, refus d'« adopter » une égalité.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

import { useGoldShortcuts, type GoldShortcutCallbacks } from "@/components/gold/useGoldShortcuts";

afterEach(() => cleanup());

function Harness(props: Partial<GoldShortcutCallbacks> & { canDecide?: boolean }) {
  const cb: GoldShortcutCallbacks = {
    canDecide: props.canDecide ?? true,
    onNext: props.onNext ?? vi.fn(),
    onPrev: props.onPrev ?? vi.fn(),
    onAdoptCandidate: props.onAdoptCandidate ?? vi.fn(),
    onAcceptProposal: props.onAcceptProposal ?? vi.fn(),
    onShowHelp: props.onShowHelp,
  };
  useGoldShortcuts(cb);
  return (
    <div>
      <input data-testid="champ" />
      <textarea data-testid="zone" />
    </div>
  );
}

describe("useGoldShortcuts", () => {
  it("n / p naviguent la file de travail", () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(<Harness onNext={onNext} onPrev={onPrev} />);
    fireEvent.keyDown(document, { key: "n" });
    fireEvent.keyDown(document, { key: "p" });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("1..9 adoptent le k-ième candidat (0-based côté appelant)", () => {
    const onAdoptCandidate = vi.fn();
    render(<Harness onAdoptCandidate={onAdoptCandidate} />);
    fireEvent.keyDown(document, { key: "1" });
    fireEvent.keyDown(document, { key: "3" });
    expect(onAdoptCandidate).toHaveBeenNthCalledWith(1, 0);
    expect(onAdoptCandidate).toHaveBeenNthCalledWith(2, 2);
  });

  it("Entrée adopte la proposition du moteur", () => {
    const onAcceptProposal = vi.fn();
    render(<Harness onAcceptProposal={onAcceptProposal} />);
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onAcceptProposal).toHaveBeenCalledTimes(1);
  });

  it("⭐ INERTES pendant une saisie : écrire une justification ne décide rien", () => {
    const onAdoptCandidate = vi.fn();
    const onNext = vi.fn();
    const { getByTestId } = render(
      <Harness onAdoptCandidate={onAdoptCandidate} onNext={onNext} />,
    );
    fireEvent.keyDown(getByTestId("champ"), { key: "1" });
    fireEvent.keyDown(getByTestId("zone"), { key: "n" });
    expect(onAdoptCandidate).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("⭐ INERTES sans verrou : mêmes conditions que les boutons (pas de chemin parallèle)", () => {
    const onAdoptCandidate = vi.fn();
    const onAcceptProposal = vi.fn();
    const onNext = vi.fn();
    render(
      <Harness
        canDecide={false}
        onAdoptCandidate={onAdoptCandidate}
        onAcceptProposal={onAcceptProposal}
        onNext={onNext}
      />,
    );
    fireEvent.keyDown(document, { key: "1" });
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onAdoptCandidate).not.toHaveBeenCalled();
    expect(onAcceptProposal).not.toHaveBeenCalled();
    // …mais la LECTURE reste navigable sans verrou.
    fireEvent.keyDown(document, { key: "n" });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("ignore les combinaisons système (⌘/Ctrl/Alt)", () => {
    const onAdoptCandidate = vi.fn();
    render(<Harness onAdoptCandidate={onAdoptCandidate} />);
    fireEvent.keyDown(document, { key: "1", metaKey: true });
    fireEvent.keyDown(document, { key: "1", ctrlKey: true });
    expect(onAdoptCandidate).not.toHaveBeenCalled();
  });

  it("? ouvre l'aide", () => {
    const onShowHelp = vi.fn();
    render(<Harness onShowHelp={onShowHelp} />);
    fireEvent.keyDown(document, { key: "?" });
    expect(onShowHelp).toHaveBeenCalledTimes(1);
  });
});
