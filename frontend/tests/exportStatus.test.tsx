/** Export en tâche de fond — puce de statut (F5). */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ExportStatusPill } from "@/components/admin/ExportStatusPill";

afterEach(() => cleanup());

describe("ExportStatusPill", () => {
  it("rend un libellé/visuel distinct par statut", () => {
    for (const [status, label] of [
      ["pending", "En file"],
      ["running", "Export en cours"],
      ["done", "Prêt"],
      ["failed", "Échec"],
    ] as const) {
      cleanup();
      render(<ExportStatusPill status={status} />);
      expect(screen.getByTestId(`export-status-${status}`)).toHaveTextContent(label);
    }
  });
});
