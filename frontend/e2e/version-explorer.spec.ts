import { test, expect } from "@playwright/test";

/**
 * Point 6 — explorateur de versions : frise document (versions nommées + diff) et
 * timeline d'évolution d'une phrase à travers annotateurs & versions.
 */

test.describe("Explorateur de versions (point 6)", () => {
  test("la frise document affiche les versions nommées et décrites", async ({ page }) => {
    await page.goto("/history/ann-1");
    const items = page.getByTestId("version-item");
    await expect(items.first()).toBeVisible();
    // Nom + description + diff visibles. La fixture v2 réutilise « données &
    // résiliation » dans name ET label → on cible le version-item et on prend le
    // premier (sélecteur déterministe, sinon strict-mode violation).
    await expect(
      items.filter({ hasText: "données & résiliation" }).first(),
    ).toBeVisible();
    await expect(page.getByText(/Différences/)).toBeVisible();
  });

  test("la timeline d'une phrase montre l'évolution par auteur/version", async ({ page }) => {
    await page.goto("/history/ann-1");
    const timeline = page.getByTestId("sentence-timeline");
    await expect(timeline).toBeVisible();
    await page.getByTestId("sentence-index-input").fill("16");
    await page.getByTestId("sentence-history-go").click();
    // Plusieurs entrées (Alice crée, Bruno re-thème, Alice change la certitude).
    await expect(page.getByTestId("sentence-history-entry")).toHaveCount(3);
    await expect(timeline.getByText("Bruno")).toBeVisible();
  });

  test("phrase sans historique → message vide", async ({ page }) => {
    await page.goto("/history/ann-1");
    await page.getByTestId("sentence-index-input").fill("99");
    await page.getByTestId("sentence-history-go").click();
    await expect(page.getByTestId("sentence-history-empty")).toBeVisible();
  });
});
