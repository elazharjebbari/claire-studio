import { test, expect } from "@playwright/test";

/**
 * F10 — Mode revue : notation + décision + commentaire. Squelette structuré.
 */

test.describe("Revue (F10)", () => {
  test("note une annotation et envoie une décision", async ({ page }) => {
    await page.goto("/review/ann-1");
    await page.getByTestId("review-decision").selectOption("approve");
    await page.getByTestId("review-body").fill("Bonne segmentation.");
    await page.getByTestId("review-submit").click();
    await expect(page.getByText(/revue.*enregistrée/i)).toBeVisible();
  });

  test.fixme("affiche le score moyen et l'historique des revues", async () => {
    // TODO.
  });
});
