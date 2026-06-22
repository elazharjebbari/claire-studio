import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { RULES, triageEngine } from "@/lib/triage";
import type { TriageResult } from "@/lib/triage";
import { SuggestionCard } from "@/components/workspace/triage/SuggestionCard";
import { TriageQueueView, type QueueRow } from "@/components/workspace/triage/TriageQueueView";

const bAll = { claude: true, codex: true, mistral: true };
const res = (c: string, x: string, m: string): TriageResult =>
  triageEngine({ claude: c, codex: x, mistral: m }, bAll, RULES)!;

describe("SuggestionCard — rendu par niveau", () => {
  it("C1 : badge Or + bouton Accepter", () => {
    render(<SuggestionCard result={res("PREAMBLE_SCOPE", "PREAMBLE_SCOPE", "PREAMBLE_SCOPE")} onAccept={() => {}} />);
    expect(screen.getByTestId("triage-badge")).toHaveTextContent("C1");
    expect(screen.getByTestId("suggestion-accept")).toHaveTextContent("Accepter");
  });

  it("C3 : valider le set + permuter + retirer 2ⁿᵈ + chips primaire/secondaire", () => {
    const onSwap = vi.fn(), onRemove = vi.fn();
    render(<SuggestionCard result={res("ACCEPTABLE_USE", "ACCEPTABLE_USE", "LICENSE_IP")}
      onAccept={() => {}} onSwap={onSwap} onRemoveSecondary={onRemove} />);
    expect(screen.getByTestId("suggestion-accept")).toHaveTextContent("Valider le set");
    expect(screen.getByTestId("chip-primary-LICENSE_IP")).toBeInTheDocument();
    expect(screen.getByTestId("chip-secondary-ACCEPTABLE_USE")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("suggestion-swap"));
    expect(onSwap).toHaveBeenCalledWith("ACCEPTABLE_USE");
    fireEvent.click(screen.getByTestId("suggestion-remove-secondary"));
    expect(onRemove).toHaveBeenCalledWith("ACCEPTABLE_USE");
  });

  it("C2 override : bouton annuler l'override", () => {
    const onUndo = vi.fn();
    render(<SuggestionCard result={res("FEES_PAYMENT", "FEES_PAYMENT", "MISC_BOILERPLATE")}
      onAccept={() => {}} onUndoOverride={onUndo} />);
    fireEvent.click(screen.getByTestId("suggestion-undo-override"));
    expect(onUndo).toHaveBeenCalled();
  });

  it("C5 : pas de bouton accepter, candidats cliquables", () => {
    const onChoose = vi.fn();
    render(<SuggestionCard result={res("PREAMBLE_SCOPE", "THIRD_PARTY_SERVICES", "GOVERNING_LAW")}
      onAccept={() => {}} onChoose={onChoose} />);
    expect(screen.queryByTestId("suggestion-accept")).toBeNull();
    fireEvent.click(screen.getByTestId("suggestion-choose-GOVERNING_LAW"));
    expect(onChoose).toHaveBeenCalledWith("GOVERNING_LAW");
  });
});

describe("TriageQueueView — navigation & gestes", () => {
  const items: QueueRow[] = [
    { index: 0, result: res("PREAMBLE_SCOPE", "PREAMBLE_SCOPE", "PREAMBLE_SCOPE") }, // C1
    { index: 2, result: res("ACCEPTABLE_USE", "ACCEPTABLE_USE", "LICENSE_IP") }, // C3
  ];
  const summary = { C1: 1, C2: 0, C3: 1, C4: 0, C5: 0 };
  const baseProps = () => ({
    items, summary, pos: 0, done: new Set<number>(), c1Count: 1,
    onPos: vi.fn(), onAccept: vi.fn(), onSwap: vi.fn(), onRemoveSecondary: vi.fn(),
    onChoose: vi.fn(), onUndoOverride: vi.fn(), onBatchAcceptC1: vi.fn(), onClose: vi.fn(),
  });

  it("affiche la position, les compteurs et la carte courante", () => {
    render(<TriageQueueView {...baseProps()} />);
    expect(screen.getByTestId("triage-position")).toHaveTextContent("phrase #0");
    expect(screen.getByTestId("triage-count-C3")).toHaveTextContent("C3 1");
    expect(screen.getByTestId("suggestion-card")).toHaveAttribute("data-level", "C1");
  });

  it("Entrée → accepte l'item courant", () => {
    const p = baseProps();
    render(<TriageQueueView {...p} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(p.onAccept).toHaveBeenCalledWith(items[0]);
  });

  it("j/k → navigation ; A → lot C1 ; ✕ → close", () => {
    const p = baseProps();
    render(<TriageQueueView {...p} />);
    fireEvent.keyDown(window, { key: "j" });
    expect(p.onPos).toHaveBeenCalledWith(1);
    fireEvent.keyDown(window, { key: "a" });
    expect(p.onBatchAcceptC1).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("triage-batch-c1"));
    expect(p.onBatchAcceptC1).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByTestId("triage-close"));
    expect(p.onClose).toHaveBeenCalled();
  });

  it("liste vide → message", () => {
    render(<TriageQueueView {...baseProps()} items={[]} c1Count={0} />);
    expect(screen.getByTestId("triage-empty")).toBeInTheDocument();
  });
});
