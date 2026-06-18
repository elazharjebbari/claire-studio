import { test, expect } from "@playwright/test";

/**
 * F5 — Export multi-format. Squelette structuré : choisir un format, lancer,
 * vérifier l'artefact + manifeste.
 */

test.describe("Export (F5)", () => {
  test("lance un export JSONL et affiche l'artefact", async ({ page }) => {
    await page.goto("/admin/exports");
    await page.getByTestId("format-jsonl").check();
    await page.getByTestId("run-export").click();
    await expect(page.getByTestId("export-result")).toContainText("jsonl");
    await expect(page.getByTestId("export-result")).toContainText("/exports/");
  });

  test.fixme("propose tous les formats explicatifs (csv, conll, xml, md, hf)", async () => {
    // TODO : itérer sur chaque format et vérifier le manifeste.
  });
});
