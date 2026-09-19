import { test, expect } from "@playwright/test";

/** Page reviewer : coller un texte anglais → job → visualiseur (API simulée par MSW). */
test.describe("Page reviewer — essai du classifieur", () => {
  test("coller un texte affiche un résultat segmenté", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("demo-textarea").fill(
      "We may terminate your account at any time without notice. All fees are due within thirty days and are not refundable.",
    );
    await expect(page.getByTestId("demo-classify")).toBeEnabled();
    await page.getByTestId("demo-classify").click();
    await expect(page.getByTestId("demo-result")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("demo-sentence-row")).toHaveCount(2);
    await expect(page.getByTestId("demo-boundary")).toHaveCount(2);
    await expect(page.getByTestId("demo-toc")).toContainText("Termination");
  });
});
