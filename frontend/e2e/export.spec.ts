import { test, expect } from "@playwright/test";

/**
 * F5 — Export EN TÂCHE DE FOND. Choisir un format, lancer (non bloquant), voir
 * l'historique avec les statuts, télécharger un export prêt, relancer un échec.
 * S'appuie sur MSW.
 */

test.describe("Export en tâche de fond (F5)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/exports");
    await expect(page.getByRole("heading", { name: "Exports" })).toBeVisible();
  });

  test("lance un export et affiche l'historique avec statuts", async ({ page }) => {
    await page.getByTestId("format-jsonl").check();
    await page.getByTestId("run-export").click();
    // Historique visible : un job prêt (Télécharger) + un échoué (Relancer).
    await expect(page.getByTestId("export-history")).toBeVisible();
    await expect(page.getByTestId("export-status-done")).toBeVisible();
    await expect(page.getByTestId("download-exp-1")).toBeVisible();
    await expect(page.getByTestId("retry-exp-2")).toBeVisible();
  });

  test("propose plusieurs formats explicatifs", async ({ page }) => {
    for (const fmt of ["csv", "conll", "xml", "md", "iaa_matrix"]) {
      await expect(page.getByTestId(`format-${fmt}`)).toBeVisible();
    }
  });
});
