/**
 * ConcordancePanel (point 4) — encart KPI de concordance sur le tableau de bord projet.
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ConcordancePanel } from "@/components/projects/ConcordancePanel";
import type { ProjectConcordance } from "@/types/contract";

afterEach(cleanup);

const DATA: ProjectConcordance = {
  perJudge: [
    { judge: "claude", pct: 82, n: 40, matches: 33 },
    { judge: "codex", pct: 61, n: 40, matches: 24 },
    { judge: "mistral", pct: null, n: 0, matches: 0 },
  ],
  bestMatch: { judge: "claude", pct: 82 },
  llmPairs: [{ a: "claude", b: "codex", pct: 74, n: 40 }],
  llmMeanPct: 74,
  documentsCompared: 3,
  humanCovered: 40,
};

describe("ConcordancePanel", () => {
  it("met en avant le meilleur modèle et affiche chaque accord + LLM↔LLM", () => {
    render(<ConcordancePanel data={DATA} />);
    expect(screen.getByTestId("concordance-panel")).toBeInTheDocument();
    expect(screen.getByTestId("concordance-panel-best")).toHaveTextContent("Claude");
    expect(screen.getByTestId("concordance-panel-best")).toHaveTextContent("82%");
    const rows = screen.getByTestId("concordance-panel-rows");
    expect(rows).toHaveTextContent("Claude");
    expect(rows).toHaveTextContent("82%");
    expect(rows).toHaveTextContent("61%");
    // Modèle sans support → tiret.
    expect(rows).toHaveTextContent("—");
    expect(screen.getByTestId("concordance-panel-llm-mean")).toHaveTextContent("74%");
  });
});
