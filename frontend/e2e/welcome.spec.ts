import { test, expect } from "@playwright/test";

/**
 * Landing publique Pactiva. Le contenu d'accueil vit désormais à la racine `/` ;
 * `/welcome` reste un alias qui y redirige. Page statique accessible sans auth.
 */
test.describe("Landing publique (Pactiva)", () => {
  test("affiche la valeur et mène à l'inscription", async ({ page }) => {
    await page.goto("/welcome");
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: /risque contractuel/i }),
    ).toBeVisible();
    await expect(page.getByTestId("welcome-login")).toBeVisible();
    await expect(page.getByTestId("welcome-signup")).toBeVisible();

    await page.getByTestId("welcome-signup").click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByTestId("signup-submit")).toBeVisible();
  });
});
