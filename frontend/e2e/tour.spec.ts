import { test, expect } from "@playwright/test";

/**
 * Visite guidée du workspace (driver.js). En mode mock, l'auto-démarrage est
 * désactivé : seul le bouton « Visite guidée » lance la visite.
 */

test.describe("Visite guidée du workspace", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
  });

  test("le bouton lance la visite, Suivant avance, Échap ferme", async ({ page }) => {
    // Aucun popover avant le clic (pas d'auto-démarrage en mode mock).
    await expect(page.locator(".driver-popover")).toHaveCount(0);

    await page.getByTestId("start-tour").click();

    const popover = page.locator(".driver-popover");
    await expect(popover).toBeVisible();
    const firstTitle = await popover.locator(".driver-popover-title").textContent();

    // Suivant avance d'une étape.
    await popover.locator(".driver-popover-next-btn").click();
    await expect(popover).toBeVisible();
    const secondTitle = await popover.locator(".driver-popover-title").textContent();
    expect(secondTitle).not.toBe(firstTitle);

    // Échap ferme la visite.
    await page.keyboard.press("Escape");
    await expect(page.locator(".driver-popover")).toHaveCount(0);
  });
});
