import { test, expect } from "@playwright/test";

/**
 * F12 — Overlay d'injustice CLAUDETTE : surlignage natif togglable, info-bulle
 * catégorie + niveau.
 */

test.describe("Overlay injustice CLAUDETTE (F12)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
  });

  test("affiche le surlignage par défaut et le retire au toggle", async ({ page }) => {
    // Phrase 22 = arbitrage (catégorie A, niveau 3).
    await expect(page.getByTestId("unfairness-22")).toBeVisible();

    await page.getByTestId("toggle-unfairness").uncheck();
    await expect(page.getByTestId("unfairness-22")).toHaveCount(0);

    await page.getByTestId("toggle-unfairness").check();
    await expect(page.getByTestId("unfairness-22")).toBeVisible();
  });

  test("expose la catégorie et le niveau en info-bulle", async ({ page }) => {
    await expect(page.getByTestId("unfairness-20")).toHaveAttribute(
      "title",
      /Limitation of liability/,
    );
  });
});
