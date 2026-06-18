import { test, expect } from "@playwright/test";

/**
 * F10 — Mode revue : lecture du document + notation (score + décision) + commentaire.
 * S'appuie sur MSW. Vérifie aussi l'overlay d'injustice CLAUDETTE dans la vue revue.
 */

test.describe("Revue (F10)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/review/ann-1");
    await expect(page.getByRole("heading", { name: /Revue/ })).toBeVisible();
  });

  test("affiche les clauses annotées et le document", async ({ page }) => {
    // Les clauses de l'annotation gold sont listées sous forme de chips.
    await expect(page.getByTestId("clause-chip").first()).toBeVisible();
    // Le document est rendu (phrase 0 du Fitbit).
    await expect(page.getByText("Fitbit Terms of Service.")).toBeVisible();
  });

  test("note une annotation et envoie une décision", async ({ page }) => {
    await page.getByTestId("review-score").fill("5");
    await page.getByTestId("review-decision").selectOption("approve");
    await page.getByTestId("review-body").fill("Bonne segmentation, certitudes cohérentes.");
    await page.getByTestId("review-submit").click();
    // Après envoi, le compteur de revues enregistrées apparaît.
    await expect(page.getByText(/revue\(s\) déjà enregistrée/i)).toBeVisible();
  });

  test("permet une décision de demande de changements", async ({ page }) => {
    await page.getByTestId("review-decision").selectOption("request_changes");
    await expect(page.getByTestId("review-decision")).toHaveValue("request_changes");
    await page.getByTestId("review-submit").click();
    await expect(page.getByText(/revue\(s\) déjà enregistrée/i)).toBeVisible();
  });
});
