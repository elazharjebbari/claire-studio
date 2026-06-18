import { test, expect } from "@playwright/test";

/**
 * Centre d'aide in-app : affichage, navigation par section, recherche.
 */

test.describe("Centre d'aide", () => {
  test("affiche le centre d'aide et sa navigation", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByTestId("help-center")).toBeVisible();
    await expect(page.getByTestId("help-nav-introduction")).toBeVisible();
    await expect(page.getByTestId("help-nav-raccourcis")).toBeVisible();
  });

  test("changer de section change le contenu", async ({ page }) => {
    await page.goto("/help");
    const article = page.getByTestId("help-article");
    // Section par défaut : introduction.
    await expect(article).toHaveAttribute("data-slug", "introduction");

    await page.getByTestId("help-nav-raccourcis").click();
    await expect(article).toHaveAttribute("data-slug", "raccourcis");
    await expect(page.getByTestId("help-content").getByText("Raccourcis clavier")).toBeVisible();
  });

  test("la recherche filtre les sections", async ({ page }) => {
    await page.goto("/help");
    await page.getByTestId("help-search").fill("certitude");
    await expect(page.getByTestId("help-nav-certitude")).toBeVisible();
    await expect(page.getByTestId("help-nav-introduction")).toHaveCount(0);
  });

  test("le lien d'aide de la TopBar mène au centre d'aide", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("help-link").click();
    await expect(page.getByTestId("help-center")).toBeVisible();
  });
});
