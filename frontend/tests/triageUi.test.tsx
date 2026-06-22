import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { RULES, triageEngine } from "@/lib/triage";
import type { TriageResult } from "@/lib/triage";
import { SuggestionCard } from "@/components/workspace/triage/SuggestionCard";
import { TriageQueueView, type QueueRow } from "@/components/workspace/triage/TriageQueueView";
import { TriageQueue } from "@/components/workspace/triage/TriageQueue";
import { useWorkspaceStore } from "@/store/workspace";

// La file conteneur dérive ses items de useTriage (juges LLM) : on le mocke pour piloter
// le contenu et tester l'INTÉGRATION avec le store (acceptation + synchro de sélection).
vi.mock("@/lib/triage/useTriage", () => ({ useTriage: vi.fn() }));
import { useTriage } from "@/lib/triage/useTriage";
const mockUseTriage = vi.mocked(useTriage);

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
    items, summary, pos: 0, done: new Set<number>(), c1Count: 1, selectedCount: 0,
    onPos: vi.fn(), onAccept: vi.fn(), onSwap: vi.fn(), onRemoveSecondary: vi.fn(),
    onChoose: vi.fn(), onUndoOverride: vi.fn(), onBatchAcceptC1: vi.fn(),
    onBatchAcceptSelection: vi.fn(), onClose: vi.fn(),
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

  it("sélection : bouton « Accepter la sélection » + touche S", () => {
    const p = { ...baseProps(), selectedCount: 2 };
    render(<TriageQueueView {...p} />);
    const btn = screen.getByTestId("triage-batch-selection");
    expect(btn).toHaveTextContent("Accepter la sélection (2)");
    fireEvent.click(btn);
    expect(p.onBatchAcceptSelection).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "s" });
    expect(p.onBatchAcceptSelection).toHaveBeenCalledTimes(2);
  });

  it("sélection vide → pas de bouton sélection ni action sur S", () => {
    const p = baseProps();
    render(<TriageQueueView {...p} />);
    expect(screen.queryByTestId("triage-batch-selection")).toBeNull();
    fireEvent.keyDown(window, { key: "s" });
    expect(p.onBatchAcceptSelection).not.toHaveBeenCalled();
  });
});

describe("TriageQueue (conteneur) — acceptation via le store & synchro de sélection", () => {
  const c1 = res("PREAMBLE_SCOPE", "PREAMBLE_SCOPE", "PREAMBLE_SCOPE"); // C1
  const c3 = res("ACCEPTABLE_USE", "ACCEPTABLE_USE", "LICENSE_IP"); // C3 (phrase 2)
  const triageData = {
    items: [{ index: 0, result: c1 }, { index: 2, result: c3 }],
    byIndex: { 0: c1, 2: c3 } as Record<number, TriageResult | null>,
    summary: { C1: 1, C2: 0, C3: 1, C4: 0, C5: 0 },
    byLevel: { C1: [0], C2: [], C3: [2], C4: [], C5: [] },
    ready: true,
    judgeCount: 3,
  };

  beforeEach(() => {
    mockUseTriage.mockReturnValue(triageData as ReturnType<typeof useTriage>);
    useWorkspaceStore.getState().init({ annotationId: "1", nSentences: 5, clauses: [] });
  });

  const renderQueue = () =>
    render(<TriageQueue annotationId="1" documentId="d1" projectSlug="p" onClose={() => {}} />);

  it("Accepter écrit la clause multi-label VALIDÉE dans le store (pas de write direct)", () => {
    renderQueue();
    fireEvent.click(screen.getByTestId("suggestion-accept")); // carte courante = C1 @0
    const drafts = useWorkspaceStore.getState().draftClauses;
    const c = drafts.find((d) => d.anchorIndex === 0);
    expect(c).toBeTruthy();
    expect(c!.validated).toBe(true);
    expect(c!.triageLevel).toBe("C1");
    expect(c!.theme).toBe("PREAMBLE_SCOPE");
    expect(c!.themes?.some((t) => t.role === "primary")).toBe(true);
  });

  it("doc → file : focaliser la phrase 2 positionne la file sur sa carte", () => {
    useWorkspaceStore.getState().focusSentence(2);
    renderQueue();
    expect(screen.getByTestId("triage-position")).toHaveTextContent("phrase #2");
  });

  it("multi-sélection : « Accepter la sélection » applique le lot au store", () => {
    useWorkspaceStore.getState().setSelection([0, 2]);
    renderQueue();
    const btn = screen.getByTestId("triage-batch-selection");
    expect(btn).toHaveTextContent("(2)");
    fireEvent.click(btn);
    const drafts = useWorkspaceStore.getState().draftClauses;
    expect(drafts.filter((d) => d.validated && d.triageLevel).length).toBe(2);
    expect(drafts.map((d) => d.anchorIndex).sort()).toEqual([0, 2]);
  });

  it("readOnly : aucune écriture dans le store à l'acceptation", () => {
    useWorkspaceStore.getState().init({ annotationId: "1", nSentences: 5, clauses: [], readOnly: true });
    renderQueue();
    fireEvent.click(screen.getByTestId("suggestion-accept"));
    expect(useWorkspaceStore.getState().draftClauses).toHaveLength(0);
  });
});
