import { test, expect } from "@playwright/test";

/**
 * Chantier F — écran public. Page publique (sans authentification) listant les
 * projets publiés et affichant leurs agrégats (lecture seule).
 */
test.describe("Écran public des projets publiés (chantier F)", () => {
  test("liste les projets publiés puis affiche leurs agrégats", async ({ page }) => {
    await page.goto("/public");
    await expect(page.getByTestId("public-projects")).toBeVisible();

    await page.getByRole("link", { name: /Voir les résultats/ }).first().click();
    await expect(page).toHaveURL(/\/public\//);
    await expect(page.getByTestId("public-project-detail")).toBeVisible();
    await expect(page.getByText("Distribution des thèmes")).toBeVisible();
  });
});
