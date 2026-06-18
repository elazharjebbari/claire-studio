import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClauseChip } from "@/components/ui/ClauseChip";
import { ThemePalette } from "@/components/ui/ThemePalette";
import { CertaintyPicker } from "@/components/ui/CertaintyPicker";
import { useUnfairnessIndex } from "@/components/workspace/useUnfairness";
import { renderHook } from "@testing-library/react";
import type { ReferenceLabel } from "@/types/contract";

describe("ClauseChip", () => {
  it("affiche le label du thème et porte les data-attrs", () => {
    render(<ClauseChip themeCode="PRIVACY_DATA" anchorIndex={2} selected />);
    const chip = screen.getByTestId("clause-chip");
    expect(chip).toHaveAttribute("data-theme", "PRIVACY_DATA");
    expect(chip).toHaveAttribute("data-selected", "true");
    expect(screen.getByText("Données & vie privée")).toBeInTheDocument();
    expect(screen.getByText("[2]")).toBeInTheDocument();
  });

  it("est un bouton cliquable quand onClick est fourni", () => {
    const onClick = vi.fn();
    render(<ClauseChip themeCode="META" onClick={onClick} />);
    fireEvent.click(screen.getByTestId("clause-chip"));
    expect(onClick).toHaveBeenCalled();
  });
});

describe("ThemePalette", () => {
  it("filtre et sélectionne un thème", () => {
    const onChange = vi.fn();
    render(<ThemePalette value={null} onChange={onChange} />);
    const input = screen.getByLabelText("Rechercher un thème");
    fireEvent.change(input, { target: { value: "résiliation" } });
    fireEvent.click(screen.getByTestId("theme-option-TERMINATION"));
    expect(onChange).toHaveBeenCalledWith("TERMINATION");
  });

  it("respecte la restriction de scheme (vocab fermé)", () => {
    render(<ThemePalette value={null} onChange={() => {}} themeCodes={["META", "TERMINATION"]} />);
    expect(screen.getByTestId("theme-option-META")).toBeInTheDocument();
    expect(screen.queryByTestId("theme-option-PRIVACY_DATA")).not.toBeInTheDocument();
  });
});

describe("CertaintyPicker", () => {
  it("expose un radiogroup 0–3 et notifie le changement", () => {
    const onChange = vi.fn();
    render(<CertaintyPicker value={1} onChange={onChange} />);
    expect(screen.getByTestId("certainty-1")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByTestId("certainty-3"));
    expect(onChange).toHaveBeenCalledWith(3);
  });
});

describe("useUnfairnessIndex", () => {
  it("indexe par phrase et garde le niveau le plus sévère", () => {
    const labels: ReferenceLabel[] = [
      { id: "1", sentenceId: "s", sentenceIndex: 4, category: "LTD", level: 1 },
      { id: "2", sentenceId: "s", sentenceIndex: 4, category: "LTD", level: 3 },
    ];
    const { result } = renderHook(() => useUnfairnessIndex(labels));
    expect(result.current.get(4)?.level).toBe(3);
    expect(result.current.get(4)?.label).toBe("Limitation of liability");
  });
});
