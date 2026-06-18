import { test, expect } from "@playwright/test";

/**
 * F8 — Sync des traductions file-based : déclarer un TranslationSet (dossier source
 * + langue + stratégie), lancer la sync, afficher le mapping document↔fichier.
 * S'appuie sur MSW.
 */

test.describe("Traductions (F8)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/translations");
    await expect(page.getByRole("heading", { name: "Traductions" })).toBeVisible();
  });

  test("liste les dossiers de traductions déclarés", async ({ page }) => {
    await expect(page.getByTestId("translation-set-ts-fr")).toContainText("CLAUDETTE FR");
    await expect(page.getByTestId("translation-set-ts-de")).toContainText("CLAUDETTE DE");
  });

  test("déclare un nouveau dossier source", async ({ page }) => {
    await page.getByTestId("ts-name").fill("CLAUDETTE IT");
    await page.getByTestId("ts-language").fill("it");
    await page.getByTestId("ts-folder").fill("/data/translations/claudette_it");
    await page.getByTestId("ts-strategy").selectOption("filename");
    await page.getByTestId("declare-set").click();
    await expect(page.getByText("CLAUDETTE IT")).toBeVisible();
  });

  test("lance la sync et affiche le mapping document↔fichier", async ({ page }) => {
    await page.getByTestId("sync-ts-fr").click();
    const result = page.getByTestId("sync-result");
    await expect(result).toBeVisible();
    // Un document associé (Fitbit) et un non résolu (Netflix).
    await expect(page.getByTestId("mapping-row-doc-fitbit")).toContainText("Fitbit");
    await expect(page.getByTestId("mapping-row-doc-netflix")).toContainText("non résolu");
  });
});
