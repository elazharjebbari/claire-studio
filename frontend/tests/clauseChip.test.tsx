import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ClauseChip } from "@/components/ui/ClauseChip";

describe("ClauseChip — provenance (3 types) + badge multi-label", () => {
  it("validé via le moteur → provenance moteur + code de niveau", () => {
    render(<ClauseChip themeCode="META" validated triageLevel="C2" />);
    const mark = screen.getByTestId("provenance-mark");
    expect(mark).toHaveAttribute("data-provenance", "moteur");
    expect(mark).toHaveAttribute("data-state", "valide");
    expect(mark).toHaveTextContent("C2"); // le code Cx reste un texte (couleur du niveau)
  });

  it("validé depuis une pré-annotation → provenance pre_annotation", () => {
    render(<ClauseChip themeCode="META" validated seededFrom="claude" />);
    expect(screen.getByTestId("provenance-mark")).toHaveAttribute("data-provenance", "pre_annotation");
  });

  it("validé manuellement → manuel ; non validé → pending/à valider", () => {
    const { rerender } = render(<ClauseChip themeCode="META" validated />);
    expect(screen.getByTestId("provenance-mark")).toHaveAttribute("data-provenance", "manuel");
    rerender(<ClauseChip themeCode="META" validated={false} />);
    const mark = screen.getByTestId("provenance-mark");
    expect(mark).toHaveAttribute("data-provenance", "pending");
    expect(mark).toHaveAttribute("data-state", "a_valider");
  });

  it("badge multi-label +N quand secondaires", () => {
    render(<ClauseChip themeCode="META" validated secondaryCount={2} />);
    expect(screen.getByTestId("multilabel-badge")).toHaveTextContent("+2");
  });

  it("pas de badge multi-label en mono", () => {
    render(<ClauseChip themeCode="META" validated secondaryCount={0} />);
    expect(screen.queryByTestId("multilabel-badge")).toBeNull();
  });

  it("distinction nette validé vs à-valider (accent émeraude / pointillé)", () => {
    const { rerender } = render(<ClauseChip themeCode="META" validated />);
    const validatedChip = screen.getByTestId("clause-chip");
    expect(validatedChip.style.boxShadow).toContain("inset"); // accent gauche émeraude
    expect(validatedChip.className).not.toContain("border-dashed");
    rerender(<ClauseChip themeCode="META" validated={false} />);
    const pendingChip = screen.getByTestId("clause-chip");
    expect(pendingChip.className).toContain("border-dashed"); // brouillon = pointillé
    expect(pendingChip.style.boxShadow).toBe(""); // pas d'accent « validé »
  });
});
