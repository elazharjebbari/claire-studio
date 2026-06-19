import { test, expect } from "@playwright/test";

/**
 * Chantier E — landing publique. Page statique accessible sans authentification :
 * proposition de valeur + CTA vers l'inscription / la connexion.
 */
test.describe("Landing publique (chantier E)", () => {
  test("affiche la valeur et mène à l'inscription", async ({ page }) => {
    await page.goto("/welcome");
    await expect(
      page.getByRole("heading", { name: /atelier d'annotation/i }),
    ).toBeVisible();
    await expect(page.getByTestId("welcome-login")).toBeVisible();
    await expect(page.getByTestId("welcome-signup")).toBeVisible();

    await page.getByTestId("welcome-signup").click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByTestId("signup-submit")).toBeVisible();
  });
});
