import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ClauseChip } from "@/components/ui/ClauseChip";

describe("ClauseChip — provenance (3 types) + badge multi-label", () => {
  it("validé via le moteur → marque ⚡ + niveau", () => {
    render(<ClauseChip themeCode="META" validated triageLevel="C2" />);
    const mark = screen.getByTestId("provenance-mark");
    expect(mark).toHaveAttribute("data-provenance", "moteur");
    expect(mark).toHaveAttribute("data-state", "valide");
    expect(mark).toHaveTextContent("⚡");
    expect(mark).toHaveTextContent("C2");
  });

  it("validé depuis une pré-annotation → ★", () => {
    render(<ClauseChip themeCode="META" validated seededFrom="claude" />);
    expect(screen.getByTestId("provenance-mark")).toHaveAttribute("data-provenance", "pre_annotation");
    expect(screen.getByTestId("provenance-mark")).toHaveTextContent("★");
  });

  it("validé manuellement → ✎ ; non validé → ◷", () => {
    const { rerender } = render(<ClauseChip themeCode="META" validated />);
    expect(screen.getByTestId("provenance-mark")).toHaveTextContent("✎");
    rerender(<ClauseChip themeCode="META" validated={false} />);
    expect(screen.getByTestId("provenance-mark")).toHaveAttribute("data-state", "a_valider");
    expect(screen.getByTestId("provenance-mark")).toHaveTextContent("◷");
  });

  it("badge multi-label +N quand secondaires", () => {
    render(<ClauseChip themeCode="META" validated secondaryCount={2} />);
    expect(screen.getByTestId("multilabel-badge")).toHaveTextContent("+2");
  });

  it("pas de badge multi-label en mono", () => {
    render(<ClauseChip themeCode="META" validated secondaryCount={0} />);
    expect(screen.queryByTestId("multilabel-badge")).toBeNull();
  });
});
