import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { RULES, triageEngine } from "@/lib/triage";
import type { TriageResult } from "@/lib/triage";
import { QuickActionRail } from "@/components/workspace/QuickActionRail";

const bAll = { claude: true, codex: true, mistral: true };
const res = (c: string, x: string, m: string): TriageResult =>
  triageEngine({ claude: c, codex: x, mistral: m }, bAll, RULES)!;

const C1 = res("PREAMBLE_SCOPE", "PREAMBLE_SCOPE", "PREAMBLE_SCOPE"); // unanime → C1
const C5 = res("PREAMBLE_SCOPE", "THIRD_PARTY_SERVICES", "GOVERNING_LAW"); // éclaté → C5

function setup(over: Partial<React.ComponentProps<typeof QuickActionRail>> = {}) {
  const props = {
    index: 3,
    active: true,
    result: C1,
    canValidate: true,
    onValidateAdvance: vi.fn(),
    onAcceptTriage: vi.fn(),
    ...over,
  };
  render(<QuickActionRail {...props} />);
  return props;
}

describe("QuickActionRail — rail d'actions rapides", () => {
  it("bouton 1 : valide + avance (transmet l'index et le clientY)", () => {
    const p = setup();
    fireEvent.click(screen.getByTestId("quick-validate-3"));
    expect(p.onValidateAdvance).toHaveBeenCalledWith(3, expect.any(Number));
  });

  it("bouton 1 désactivé quand rien à valider", () => {
    const p = setup({ canValidate: false });
    expect(screen.getByTestId("quick-validate-3")).toBeDisabled();
    fireEvent.click(screen.getByTestId("quick-validate-3"));
    expect(p.onValidateAdvance).not.toHaveBeenCalled();
  });

  it("bouton 2 (C1) : clic applique la règle (onAcceptTriage avec le niveau)", () => {
    const onAcceptTriage = vi.fn();
    setup({ result: C1, onAcceptTriage });
    const btn = screen.getByTestId("quick-suggest-3");
    expect(btn).toHaveTextContent("C1");
    fireEvent.click(btn);
    expect(onAcceptTriage).toHaveBeenCalledTimes(1);
    const [idx, themes, , level] = onAcceptTriage.mock.calls[0]!;
    expect(idx).toBe(3);
    expect(level).toBe("C1");
    expect((themes as { role: string }[]).some((t) => t.role === "primary")).toBe(true);
  });

  it("bouton 2 (C5) : le clic N'applique PAS, il ouvre la carte (arbitrage)", () => {
    const p = setup({ result: C5 });
    fireEvent.click(screen.getByTestId("quick-suggest-3"));
    expect(p.onAcceptTriage).not.toHaveBeenCalled();
    expect(screen.getByTestId("quick-suggest-card-3")).toBeInTheDocument();
  });

  it("hover : affiche la carte de suggestion (SuggestionCard réutilisée)", () => {
    setup({ result: C1 });
    expect(screen.queryByTestId("quick-suggest-card-3")).toBeNull();
    // le bouton 2 est enveloppé par le conteneur qui gère le survol
    fireEvent.mouseEnter(screen.getByTestId("quick-suggest-3").parentElement!);
    expect(screen.getByTestId("quick-suggest-card-3")).toBeInTheDocument();
    expect(screen.getByTestId("suggestion-card")).toBeInTheDocument();
  });

  it("sans triage : seul le bouton 1 est rendu", () => {
    setup({ result: null });
    expect(screen.getByTestId("quick-validate-3")).toBeInTheDocument();
    expect(screen.queryByTestId("quick-suggest-3")).toBeNull();
  });
});
