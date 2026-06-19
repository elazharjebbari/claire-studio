import { test, expect } from "@playwright/test";

/**
 * Chantier G — séparation admin / annotateur. En mode mock, l'utilisateur de démo
 * est admin : la garde de rôle laisse passer, la console s'affiche et la section
 * Administration de la nav est visible. (Le 403 pour un non-admin est couvert en
 * unitaire : tests/adminGuard.test.tsx.)
 */
test.describe("Console d'administration (chantier G)", () => {
  test("l'admin accède à la console et voit la nav admin (garde passante)", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByTestId("admin-nav")).toBeVisible();
    await expect(page.getByTestId("admin-forbidden")).toHaveCount(0);
    // Saut vers une sous-section admin gardée.
    await page.getByTestId("admin-nav").getByRole("link", { name: "Utilisateurs" }).click();
    await expect(page).toHaveURL(/\/admin\/users/);
  });
});
