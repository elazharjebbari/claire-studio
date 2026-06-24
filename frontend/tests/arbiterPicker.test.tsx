/**
 * ArbiterPicker — autocomplétion d'ajout d'arbitres (filtre, ajout, retrait, clavier).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ArbiterPicker } from "@/components/gold/ArbiterPicker";
import type { ProjectMember } from "@/types/contract";

const MEMBERS: ProjectMember[] = [
  { id: "1", userId: "u1", username: "alice", displayName: "Alice", role: "lead" },
  { id: "2", userId: "u2", username: "bruno", displayName: "Bruno", role: "annotator" },
  { id: "3", userId: "u3", username: "camille", displayName: "Camille", role: "annotator" },
];

afterEach(() => cleanup());

describe("ArbiterPicker", () => {
  it("filtre les membres et ajoute par clic", () => {
    const onChange = vi.fn();
    render(<ArbiterPicker members={MEMBERS} value={[]} onChange={onChange} />);

    fireEvent.focus(screen.getByTestId("arbiter-input"));
    fireEvent.change(screen.getByTestId("arbiter-input"), { target: { value: "bru" } });

    // Seul Bruno correspond.
    expect(screen.getByTestId("arbiter-option-bruno")).toBeInTheDocument();
    expect(screen.queryByTestId("arbiter-option-camille")).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("arbiter-option-bruno"));
    expect(onChange).toHaveBeenCalledWith(["bruno"]);
  });

  it("affiche les arbitres sélectionnés en chips et permet de les retirer", () => {
    const onChange = vi.fn();
    render(<ArbiterPicker members={MEMBERS} value={["bruno"]} onChange={onChange} />);
    expect(screen.getByTestId("arbiter-chip-bruno")).toHaveTextContent("Bruno");
    fireEvent.click(screen.getByTestId("arbiter-remove-bruno"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("n'affiche plus un membre déjà sélectionné dans les options", () => {
    render(<ArbiterPicker members={MEMBERS} value={["bruno"]} onChange={() => {}} />);
    fireEvent.focus(screen.getByTestId("arbiter-input"));
    fireEvent.change(screen.getByTestId("arbiter-input"), { target: { value: "bru" } });
    expect(screen.queryByTestId("arbiter-option-bruno")).not.toBeInTheDocument();
    expect(screen.getByTestId("arbiter-no-match")).toBeInTheDocument();
  });

  it("ajoute via la touche Entrée (clavier)", () => {
    const onChange = vi.fn();
    render(<ArbiterPicker members={MEMBERS} value={[]} onChange={onChange} />);
    const input = screen.getByTestId("arbiter-input");
    fireEvent.change(input, { target: { value: "cam" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["camille"]);
  });
});
