import { test, expect } from "@playwright/test";

/**
 * Racine publique `/` = page reviewer anglaise (docs/pactiva-reviewer-demo) ; `/welcome`
 * reste un alias qui y redirige ; la présentation française vit sur `/presentation`.
 */
test.describe("Page reviewer (racine publique)", () => {
  test("affiche le papier, mène à la connexion et à la présentation française", async ({ page }) => {
    await page.goto("/welcome");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /A Thematic Layer for CLAUDETTE/i })).toBeVisible();
    await expect(page.getByTestId("hero-fingerprint")).toContainText("Dataset fingerprint");
    await expect(page.getByTestId("demo-panel")).toBeVisible();
    await expect(page.getByTestId("release-zip")).toBeVisible();
    await expect(page.getByTestId("key-figures")).toBeVisible();
    await expect(page.getByTestId("welcome-login")).toBeVisible();

    await page.getByTestId("welcome-presentation").click();
    await expect(page).toHaveURL(/\/presentation/);
    await expect(page.getByRole("heading", { name: /risque contractuel/i })).toBeVisible();
  });
});
