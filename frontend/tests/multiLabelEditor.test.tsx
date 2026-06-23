import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { useWorkspaceStore } from "@/store/workspace";
import { MultiLabelEditor } from "@/components/workspace/MultiLabelEditor";
import type { Clause } from "@/types/contract";

const themeCodes = ["META", "TERMINATION", "LICENSE_IP", "PREAMBLE_SCOPE", "FEES_PAYMENT"];
const base: Clause[] = [{ id: "c1", annotationId: "a1", anchorIndex: 0, theme: "META", order: 0 }];
const draftC1 = () => useWorkspaceStore.getState().draftClauses.find((d) => d.localId === "c1")!;

describe("MultiLabelEditor — multi-label hors C3 + toggle", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    useWorkspaceStore.getState().init({ annotationId: "a1", nSentences: 5, clauses: base });
  });

  it("mono : toggle ouvre le picker (refuge + primaire exclus) et ajoute un secondaire", () => {
    render(<MultiLabelEditor draft={draftC1()} themeCodes={themeCodes} />);
    expect(screen.getByTestId("multilabel-toggle")).toHaveTextContent("Mono");
    fireEvent.click(screen.getByTestId("multilabel-toggle"));
    expect(screen.queryByTestId("theme-option-PREAMBLE_SCOPE")).toBeNull(); // refuge exclu
    expect(screen.queryByTestId("theme-option-META")).toBeNull(); // primaire exclu
    fireEvent.click(screen.getByTestId("theme-option-LICENSE_IP"));
    const themes = draftC1().themes ?? [];
    expect(themes.find((t) => t.label === "LICENSE_IP" && t.role === "secondary")).toBeTruthy();
    expect(themes.find((t) => t.label === "META" && t.role === "primary")).toBeTruthy();
  });

  it("multi : chip secondaire retirable", () => {
    useWorkspaceStore.getState().setClauseThemes("c1", [
      { label: "META", role: "primary" },
      { label: "LICENSE_IP", role: "secondary" },
    ]);
    render(<MultiLabelEditor draft={draftC1()} themeCodes={themeCodes} />);
    expect(screen.getByTestId("multilabel-toggle")).toHaveTextContent("Multi-label");
    expect(screen.getByTestId("secondary-chip-LICENSE_IP")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("remove-secondary-LICENSE_IP"));
    expect((draftC1().themes ?? []).some((t) => t.role === "secondary")).toBe(false);
  });

  it("toggle Multi→Mono retire les secondaires (réversible)", () => {
    useWorkspaceStore.getState().setClauseThemes("c1", [
      { label: "META", role: "primary" },
      { label: "LICENSE_IP", role: "secondary" },
    ]);
    render(<MultiLabelEditor draft={draftC1()} themeCodes={themeCodes} />);
    fireEvent.click(screen.getByTestId("multilabel-toggle"));
    expect((draftC1().themes ?? []).filter((t) => t.role === "secondary")).toHaveLength(0);
  });
});
