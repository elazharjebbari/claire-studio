import { test, expect } from "@playwright/test";

/**
 * F5 — Export multi-format. Choisir un format, lancer, vérifier l'artefact + le
 * manifeste. Itère sur plusieurs formats explicatifs. S'appuie sur MSW.
 */

test.describe("Export (F5)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/exports");
    await expect(page.getByRole("heading", { name: "Exports" })).toBeVisible();
  });

  test("lance un export JSONL et affiche l'artefact + manifeste", async ({ page }) => {
    await page.getByTestId("format-jsonl").check();
    await page.getByTestId("run-export").click();
    const result = page.getByTestId("export-result");
    await expect(result).toContainText("jsonl");
    await expect(result).toContainText("/exports/");
    await expect(result).toContainText("done");
    // Le manifeste JSON est affiché.
    await expect(result).toContainText("documents");
  });

  test("propose et exporte plusieurs formats explicatifs", async ({ page }) => {
    for (const fmt of ["csv", "conll", "xml", "md", "huggingface"]) {
      await expect(page.getByTestId(`format-${fmt}`)).toBeVisible();
    }
    // Exporte au format CoNLL et vérifie le reflet dans le résultat.
    await page.getByTestId("format-conll").check();
    await page.getByTestId("run-export").click();
    await expect(page.getByTestId("export-result")).toContainText("conll");
  });
});
